import { Injectable, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { DevelopmentDto } from '@yorga/contracts';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { claveTarea, parsearClaveTarea } from '../domain/clave';
import { clavesEnTexto, nombreDeRama, primeraLinea, resumenDesarrollo } from '../domain/git';
import { CommentsService } from './comments.service';

const BOT_EMAIL = 'github@tareas.local';

interface Commit { id: string; message: string; url: string; distinct?: boolean; timestamp?: string; author?: { name?: string; email?: string } }
interface Payload {
  repository?: { full_name: string };
  ref?: string;
  deleted?: boolean;
  commits?: Commit[];
  action?: string;
  pull_request?: { number: number; title: string; body: string | null; html_url: string; merged?: boolean; created_at?: string; merged_at?: string | null; user?: { login: string }; head?: { ref: string }; base?: { ref: string } };
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
      if (p.deleted) return { comentarios: 0 };
      const rama = (p.ref ?? '').replace(/^refs\/heads\//, '');
      // Rama con la clave en el nombre (feat/COOL-32-guia): sale en el panel, y sus commits también.
      const clavesRama = clavesEnTexto(rama.toUpperCase(), await this.proyectos());
      for (const clave of clavesRama) await this.registrar(clave, { kind: 'branch', ref: `${repo}:${rama}`, url: `https://github.com/${repo}/tree/${rama}`, title: rama, repo, branch: rama });
      for (const c of p.commits ?? []) {
        if (c.distinct === false) continue; // el mismo commit llegando por otra rama
        const corto = c.id.slice(0, 7);
        const autor = await this.autor(c.author?.email);
        const texto = `💻 **Commit** [\`${corto}\`](${c.url}) en \`${repo}\` (rama \`${rama}\`)${c.author?.name ? ` por ${c.author.name}` : ''}\n\n> ${primeraLinea(c.message)}`;
        const datos = { kind: 'commit', ref: `${repo}@${c.id}`, url: c.url, title: primeraLinea(c.message), repo, branch: rama, author: c.author?.name ?? null, at: c.timestamp ? new Date(c.timestamp) : null };
        const enMensaje = clavesEnTexto(c.message, await this.proyectos());
        // Los que la nombran en el mensaje: comentario + panel. Los de su rama que no la nombran: sólo panel.
        for (const clave of enMensaje) n += (await this.registrar(clave, datos, { cuerpo: texto, autorId: autor })) ? 1 : 0;
        for (const clave of clavesRama.filter((k) => !enMensaje.includes(k))) await this.registrar(clave, datos);
      }
    } else if (evento === 'pull_request' && p.pull_request) {
      const pr = p.pull_request;
      const tipo = p.action === 'opened' ? 'pr-opened' : p.action === 'closed' && pr.merged ? 'pr-merged' : null;
      if (tipo) {
        const que = tipo === 'pr-opened' ? `🔀 **PR #${pr.number} abierta**` : `✅ **PR #${pr.number} mergeada** en \`${pr.base?.ref ?? ''}\``;
        const texto = `${que}: [${pr.title}](${pr.html_url}) en \`${repo}\`${pr.user?.login ? ` por ${pr.user.login}` : ''}`;
        // La clave puede venir en el título, en la descripción o en el nombre de la rama (feat/COOL-32-guia).
        const donde = `${pr.title}\n${pr.body ?? ''}\n${(pr.head?.ref ?? '').toUpperCase()}`;
        const datos = { kind: tipo, ref: `${repo}#${pr.number}`, url: pr.html_url, title: pr.title, repo, branch: pr.head?.ref ?? null, author: pr.user?.login ?? null, number: pr.number, at: new Date((tipo === 'pr-merged' ? pr.merged_at : pr.created_at) ?? Date.now()) };
        const bot = await this.bot();
        for (const clave of clavesEnTexto(donde, await this.proyectos())) n += (await this.registrar(clave, datos, { cuerpo: texto, autorId: bot })) ? 1 : 0;
      }
    }
    if (n) this.log.log(`${evento} ${repo}: ${n} comentario(s)`);
    return { comentarios: n };
  }

  private async proyectos(): Promise<string[]> {
    return (await this.prisma.project.findMany({ select: { key: true } })).map((p) => p.key);
  }

  /**
   * Guarda que esta tarea sale en `ref` (una vez) y, si se pide, comenta en ella.
   * Devuelve true si era nuevo (y por tanto se comentó, si tocaba).
   */
  private async registrar(
    clave: string,
    d: { kind: string; ref: string; url: string; title: string; repo: string; branch?: string | null; author?: string | null; number?: number | null; at?: Date | null },
    comentario?: { cuerpo: string; autorId: number },
  ): Promise<boolean> {
    const parsed = parsearClaveTarea(clave);
    if (!parsed) return false;
    const t = await this.prisma.task.findFirst({ where: { number: parsed.number, project: { key: parsed.projectKey } }, select: { id: true } });
    if (!t) return false;
    const ya = await this.prisma.taskGitRef.findUnique({ where: { taskId_kind_ref: { taskId: t.id, kind: d.kind, ref: d.ref } } });
    if (ya) return false;
    await this.prisma.taskGitRef.create({ data: { taskId: t.id, kind: d.kind, ref: d.ref, url: d.url, title: d.title.slice(0, 300), repo: d.repo, branch: d.branch ?? null, author: d.author ?? null, number: d.number ?? null, at: d.at ?? null } });
    if (comentario) await this.comments.add(t.id, comentario.cuerpo, comentario.autorId);
    return true;
  }

  /** Panel «Desarrollo» de una tarea. */
  async desarrollo(taskId: number): Promise<DevelopmentDto> {
    const t = await this.prisma.task.findUnique({ where: { id: taskId }, select: { number: true, title: true, type: true, project: { select: { key: true } } } });
    if (!t) throw new NotFoundException('Tarea no encontrada.');
    const refs = await this.prisma.taskGitRef.findMany({ where: { taskId } });
    return { ...resumenDesarrollo(refs), suggestedBranch: nombreDeRama(claveTarea(t.project.key, t.number), t.title, t.type === 'BUG' || t.type === 'INCIDENT' ? 'fix' : 'feat') };
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
