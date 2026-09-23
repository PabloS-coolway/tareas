import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { parsearClaveTarea } from '../domain/clave';
import { clavesEnTexto, primeraLinea } from '../domain/git';
import { CommentsService } from './comments.service';

const BOT_EMAIL = 'github@tareas.local';

interface Commit { id: string; message: string; url: string; distinct?: boolean; author?: { name?: string; email?: string } }
interface Payload {
  repository?: { full_name: string };
  ref?: string;
  commits?: Commit[];
  action?: string;
  pull_request?: { number: number; title: string; body: string | null; html_url: string; merged?: boolean; user?: { login: string }; head?: { ref: string }; base?: { ref: string } };
}

/**
 * Webhook de GitHub: cuando un commit o una PR mencionan una tarea (COOL-32…), se comenta en ella con el
 * enlace. Sólo comenta: nada se cierra solo (decisión de Pablo, 23-sep-2026). Cada commit/PR, una vez.
 */
@Injectable()
export class GithubService {
  private readonly log = new Logger('GitHub');

  constructor(
    private readonly prisma: PrismaService,
    private readonly comments: CommentsService,
  ) {}

  /** Firma `X-Hub-Signature-256` con el secreto compartido (GITHUB_WEBHOOK_SECRET). */
  verificar(raw: Buffer | undefined, firma: string | undefined): void {
    const secreto = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secreto) throw new ServiceUnavailableException('Integración con GitHub sin configurar (falta GITHUB_WEBHOOK_SECRET).');
    const esperada = Buffer.from(`sha256=${createHmac('sha256', secreto).update(raw ?? Buffer.alloc(0)).digest('hex')}`);
    const llega = Buffer.from(firma ?? '');
    if (llega.length !== esperada.length || !timingSafeEqual(llega, esperada)) throw new UnauthorizedException('Firma de GitHub no válida.');
  }

  async recibir(evento: string, p: Payload): Promise<{ comentarios: number }> {
    const repo = p.repository?.full_name ?? '?';
    let n = 0;
    if (evento === 'push') {
      const rama = (p.ref ?? '').replace(/^refs\/heads\//, '');
      for (const c of p.commits ?? []) {
        if (c.distinct === false) continue; // el mismo commit llegando por otra rama
        const corto = c.id.slice(0, 7);
        const autor = await this.autor(c.author?.email);
        const texto = `💻 **Commit** [\`${corto}\`](${c.url}) en \`${repo}\` (rama \`${rama}\`)${c.author?.name ? ` por ${c.author.name}` : ''}\n\n> ${primeraLinea(c.message)}`;
        n += await this.comentar(c.message, 'commit', `${repo}@${c.id}`, c.url, primeraLinea(c.message), texto, autor);
      }
    } else if (evento === 'pull_request' && p.pull_request) {
      const pr = p.pull_request;
      const tipo = p.action === 'opened' ? 'pr-opened' : p.action === 'closed' && pr.merged ? 'pr-merged' : null;
      if (tipo) {
        const que = tipo === 'pr-opened' ? `🔀 **PR #${pr.number} abierta**` : `✅ **PR #${pr.number} mergeada** en \`${pr.base?.ref ?? ''}\``;
        const texto = `${que}: [${pr.title}](${pr.html_url}) en \`${repo}\`${pr.user?.login ? ` por ${pr.user.login}` : ''}`;
        // La clave puede venir en el título, en la descripción o en el nombre de la rama (feat/COOL-32-guia).
        const donde = `${pr.title}\n${pr.body ?? ''}\n${(pr.head?.ref ?? '').toUpperCase()}`;
        n += await this.comentar(donde, tipo, `${repo}#${pr.number}`, pr.html_url, pr.title, texto, await this.bot());
      }
    }
    if (n) this.log.log(`${evento} ${repo}: ${n} comentario(s)`);
    return { comentarios: n };
  }

  private async comentar(texto: string, kind: string, ref: string, url: string, titulo: string, cuerpo: string, autorId: number): Promise<number> {
    const proyectos = (await this.prisma.project.findMany({ select: { key: true } })).map((p) => p.key);
    let n = 0;
    for (const clave of clavesEnTexto(texto, proyectos)) {
      const parsed = parsearClaveTarea(clave)!;
      const t = await this.prisma.task.findFirst({ where: { number: parsed.number, project: { key: parsed.projectKey } }, select: { id: true } });
      if (!t) continue;
      const ya = await this.prisma.taskGitRef.findUnique({ where: { taskId_kind_ref: { taskId: t.id, kind, ref } } });
      if (ya) continue;
      await this.prisma.taskGitRef.create({ data: { taskId: t.id, kind, ref, url, title: titulo.slice(0, 300) } });
      await this.comments.add(t.id, cuerpo, autorId);
      n++;
    }
    return n;
  }

  /** Si el correo del commit es de alguien del equipo, el comentario va a su nombre; si no, al del bot. */
  private async autor(email?: string): Promise<number> {
    if (email) {
      const u = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, active: true }, select: { id: true } });
      if (u) return u.id;
    }
    return this.bot();
  }

  /** Usuario «GitHub»: desactivado (no puede entrar ni sale en el directorio), sólo firma comentarios. */
  private async bot(): Promise<number> {
    const u = await this.prisma.user.findUnique({ where: { email: BOT_EMAIL }, select: { id: true } });
    if (u) return u.id;
    const nuevo = await this.prisma.user.create({ data: { email: BOT_EMAIL, name: 'GitHub', passwordHash: `!sin-acceso-${randomBytes(12).toString('hex')}`, role: 'miembro', active: false }, select: { id: true } });
    return nuevo.id;
  }
}
