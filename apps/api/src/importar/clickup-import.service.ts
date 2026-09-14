import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ClickUpImportResultDto, Priority, StatusCategory } from '@yorga/contracts';
import { PASSWORD_HASHER, PasswordHasher } from '../auth/application/ports';
import { PrismaService } from '../infrastructure/db/prisma.service';
import { AttachmentsService } from '../tareas/application/attachments.service';
import { ESTADOS_POR_DEFECTO } from '../tareas/application/projects.service';
import { proponerClave } from '../tareas/domain/clave';
import { ClickUpExport, ClickUpImportOptions, CuStatus, CuTask, CuUser } from './clickup-export.types';

/** Convierte lo que exporta ClickUp en proyectos/tareas/comentarios/adjuntos. Idempotente por `clickupId`. */
@Injectable()
export class ClickUpImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async importar(data: ClickUpExport, opts: ClickUpImportOptions, actorId: number): Promise<ClickUpImportResultDto> {
    if (!data?.lists?.length) throw new BadRequestException('El fichero no trae listas de ClickUp.');
    const res: ClickUpImportResultDto = { proyectos: 0, tareas: 0, comentarios: 0, adjuntos: 0, usuariosCreados: [], avisos: [] };

    // 1) Usuarios: por email (los de ClickUp que no existan se crean con contraseña temporal).
    const usuarios = new Map<string, number>(); // clickup user id → user id
    const miembros = [...(data.members ?? [])];
    for (const l of data.lists) for (const t of l.tasks) miembros.push(...(t.assignees ?? []), ...(t.creator ? [t.creator] : []), ...(t.comments ?? []).map((c) => c.user).filter((u): u is CuUser => !!u));
    for (const m of miembros) {
      const cid = String(m.id);
      if (usuarios.has(cid)) continue;
      const id = await this.resolverUsuario(m, res);
      if (id) usuarios.set(cid, id);
    }
    const userId = (u?: CuUser | null): number | null => (u ? (usuarios.get(String(u.id)) ?? null) : null);

    // 2) Listas → proyectos (con sus estados).
    const estandar = opts.estadosEstandar !== false;
    const ocupadas = new Set((await this.prisma.project.findMany({ select: { key: true } })).map((p) => p.key));
    for (const list of data.lists) {
      let project = await this.prisma.project.findUnique({ where: { clickupListId: list.id }, include: { statuses: true } });
      if (!project) {
        const key = (opts.keys?.[list.id] ?? proponerClave(list.name, ocupadas)).toUpperCase();
        ocupadas.add(key);
        const estados = (list.statuses?.length ? list.statuses : estadosDeTareas(list.tasks)).sort((a, b) => (a.orderindex ?? 0) - (b.orderindex ?? 0));
        const statuses = estandar
          ? ESTADOS_POR_DEFECTO.map((s, order) => ({ ...s, order }))
          : estados.map((s, order) => ({ key: claveEstado(s.status), name: s.status, color: s.color ?? '#6b7280', order, category: categoria(s) }));
        project = await this.prisma.project.create({
          data: { key, name: list.name, clickupListId: list.id, statuses: { create: statuses } },
          include: { statuses: true },
        });
        res.proyectos++;
      }
      const ordenados = [...project.statuses].sort((a, b) => a.order - b.order);
      const estadoPorNombre = new Map(ordenados.map((s) => [s.name.toLowerCase(), s]));
      const primerEstado = ordenados[0];
      const tiposDeLista = new Map((list.statuses ?? []).map((s) => [s.status.toLowerCase(), s]));
      /** Estado del proyecto para una tarea: por nombre si coincide; si no, por categoría (TODO/DOING/DONE) del estado de ClickUp. */
      const estadoPara = (t: CuTask) => {
        const nombre = (t.status?.status ?? '').toLowerCase();
        const porNombre = estadoPorNombre.get(nombre);
        if (porNombre) return porNombre;
        const cu = tiposDeLista.get(nombre) ?? t.status;
        if (!cu) return primerEstado;
        const cat = categoria(cu);
        if (cat === 'DOING' && /bloq|block/.test(nombre)) return ordenados.find((s) => /bloq/.test(s.key)) ?? ordenados.find((s) => s.category === 'DOING') ?? primerEstado;
        return ordenados.find((s) => s.category === cat) ?? primerEstado;
      };

      // 3) Tareas: primero las que no tienen padre, luego las hijas (para poder enlazar).
      const tareas = [...list.tasks].sort((a, b) => (a.parent ? 1 : 0) - (b.parent ? 1 : 0) || Number(a.orderindex ?? 0) - Number(b.orderindex ?? 0));
      const idPorClickup = new Map<string, number>();
      for (const t of tareas) {
        const estado = estadoPara(t);
        if (!estado) {
          res.avisos.push(`Tarea "${t.name}" sin estado mapeable; saltada.`);
          continue;
        }
        const parentId = t.parent ? (idPorClickup.get(t.parent) ?? (await this.prisma.task.findUnique({ where: { clickupId: t.parent }, select: { id: true } }))?.id ?? null) : null;
        if (t.parent && !parentId) res.avisos.push(`"${t.name}": su padre (${t.parent}) no está en la exportación; se importa suelta.`);
        const existente = await this.prisma.task.findUnique({ where: { clickupId: t.id } });
        const datos = {
          title: t.name || '(sin título)',
          description: t.markdown_description || t.description || '',
          statusId: estado.id,
          priority: prioridad(t),
          assigneeId: userId(t.assignees?.[0]),
          parentId,
          dueDate: fechaSolo(t.due_date),
          startDate: fechaSolo(t.start_date),
          tags: (t.tags ?? []).map((x) => x.name.toLowerCase()),
          order: Number(t.orderindex ?? 0),
          closedAt: estado.category === 'DONE' ? fecha(t.date_closed) ?? fecha(t.date_updated) : null,
          clickupUrl: t.url ?? null,
        };
        let taskId: number;
        if (existente) {
          await this.prisma.task.update({ where: { id: existente.id }, data: datos });
          taskId = existente.id;
        } else {
          taskId = await this.prisma.$transaction(async (tx) => {
            const p = await tx.project.update({ where: { id: project!.id }, data: { nextNumber: { increment: 1 } }, select: { nextNumber: true } });
            const creada = await tx.task.create({
              data: {
                ...datos,
                projectId: project!.id,
                number: p.nextNumber - 1,
                type: parentId ? 'TASK' : 'TASK',
                reporterId: userId(t.creator) ?? actorId,
                clickupId: t.id,
                createdAt: fecha(t.date_created) ?? new Date(),
              },
            });
            await tx.taskActivity.create({ data: { taskId: creada.id, actorId, action: 'imported', after: `ClickUp ${t.id}` } });
            return creada.id;
          });
          res.tareas++;
        }
        idPorClickup.set(t.id, taskId);

        // 4) Comentarios.
        for (const c of t.comments ?? []) {
          const cid = String(c.id);
          if (await this.prisma.taskComment.findUnique({ where: { clickupId: cid } })) continue;
          const texto = (c.comment_text ?? '').trim();
          if (!texto) continue;
          await this.prisma.taskComment.create({ data: { taskId, authorId: userId(c.user) ?? actorId, body: texto, clickupId: cid, createdAt: fecha(c.date) ?? new Date() } });
          res.comentarios++;
        }

        // 5) Adjuntos: se descargan de ClickUp y se guardan en nuestro almacenamiento.
        if (opts.adjuntos !== false) {
          for (const a of t.attachments ?? []) {
            if (!a.url) continue;
            if (await this.prisma.attachment.findFirst({ where: { taskId, clickupUrl: a.url } })) continue;
            try {
              const r = await fetch(a.url);
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              const buffer = Buffer.from(await r.arrayBuffer());
              await this.attachments.add(taskId, { originalname: a.title || 'adjunto', mimetype: a.mimetype || r.headers.get('content-type') || 'application/octet-stream', size: buffer.length, buffer }, actorId, a.url);
              res.adjuntos++;
            } catch (e) {
              res.avisos.push(`Adjunto "${a.title}" de "${t.name}": ${(e as Error).message}`);
            }
          }
        }
      }
    }
    return res;
  }

  /** Usuario por email: existente, o creado con contraseña temporal (se devuelve para repartirla). */
  private async resolverUsuario(m: CuUser, res: ClickUpImportResultDto): Promise<number | null> {
    const email = m.email?.trim().toLowerCase();
    const cid = String(m.id);
    const porClickup = await this.prisma.user.findUnique({ where: { clickupId: cid } });
    if (porClickup) return porClickup.id;
    if (!email) return null;
    const porEmail = await this.prisma.user.findUnique({ where: { email } });
    if (porEmail) {
      await this.prisma.user.update({ where: { id: porEmail.id }, data: { clickupId: cid } });
      return porEmail.id;
    }
    const passwordTemporal = randomBytes(6).toString('base64url');
    const u = await this.prisma.user.create({
      data: { email, name: m.username?.trim() || email.split('@')[0], passwordHash: await this.hasher.hash(passwordTemporal), role: 'miembro', clickupId: cid },
    });
    res.usuariosCreados.push({ email, name: u.name, passwordTemporal });
    return u.id;
  }
}

function claveEstado(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'estado';
}

function categoria(s: CuStatus): StatusCategory {
  const t = (s.type ?? '').toLowerCase();
  if (t === 'closed' || t === 'done') return 'DONE';
  if (t === 'open' || t === 'unstarted') return 'TODO';
  const n = s.status.toLowerCase();
  if (/complet|cerrad|done|closed|hecho/.test(n)) return 'DONE';
  if (/pendiente|to ?do|open|nuevo/.test(n)) return 'TODO';
  return 'DOING';
}

/** Si la lista no trae sus estados, se deducen de las tareas. */
function estadosDeTareas(tasks: CuTask[]): CuStatus[] {
  const vistos = new Map<string, CuStatus>();
  for (const t of tasks) if (t.status?.status && !vistos.has(t.status.status)) vistos.set(t.status.status, { ...t.status, orderindex: vistos.size });
  return [...vistos.values()];
}

function prioridad(t: CuTask): Priority {
  const p = (t.priority?.priority ?? String(t.priority?.id ?? '')).toLowerCase();
  if (p === 'urgent' || p === '1') return 'URGENT';
  if (p === 'high' || p === '2') return 'HIGH';
  if (p === 'low' || p === '4') return 'LOW';
  return 'NORMAL';
}

function fecha(v: string | number | null | undefined): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  const d = Number.isFinite(n) ? new Date(n) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function fechaSolo(v: string | number | null | undefined): Date | null {
  const d = fecha(v);
  return d ? new Date(d.toISOString().slice(0, 10)) : null;
}
