import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateTaskDto,
  MoveTaskDto,
  PRIORITIES,
  PRIORITY_LABELS,
  ResumenDto,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  TaskDto,
  TaskFilter,
  TaskPageDto,
  UpdateTaskDto,
  TagCountDto,
  DependenciesDto,
  TaskRefDto,
  RECURRENCES,
  KpisDto,
} from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { claveTarea, parsearClaveTarea } from '../domain/clave';
import { ordenPara, renumerar } from '../domain/orden';
import { AccessService } from './access.service';
import { ActivityInput, ActivityService } from './activity.service';
import { NotificationsService } from './notifications.service';
import { statusToDto } from './projects.service';

const userRef = { select: { id: true, name: true, email: true } } as const;

/** Lo que se carga con cada tarea para poder pintarla sin más consultas. */
const includeTask = {
  status: true,
  assignee: userRef,
  reporter: userRef,
  project: { select: { key: true } },
  parent: { select: { id: true, number: true, title: true, project: { select: { key: true } } } },
  sprint: { select: { id: true, name: true } },
  _count: { select: { comments: true, attachments: true, subtasks: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof includeTask }>;

const fecha = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);
const parseFecha = (s: string | null | undefined): Date | null | undefined => {
  if (s === undefined) return undefined;
  if (s === null || s === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestException(`Fecha inválida: ${s} (usa AAAA-MM-DD).`);
  return new Date(`${s}T00:00:00.000Z`);
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
    private readonly access: AccessService,
  ) {}

  // ---------- Lectura ----------

  async list(f: TaskFilter, userId: number): Promise<TaskPageDto> {
    const where: Prisma.TaskWhereInput = {};
    // Visibilidad por equipo: sólo proyectos que quien pregunta puede ver.
    const proyecto = await this.access.projectFilter(userId, f.projectId);
    if (proyecto !== undefined) where.projectId = proyecto;
    if (f.statusId) where.statusId = f.statusId;
    if (f.assigneeId === 'me') where.assigneeId = userId;
    else if (f.assigneeId === 'none') where.assigneeId = null;
    else if (typeof f.assigneeId === 'number') where.assigneeId = f.assigneeId;
    if (f.priority) where.priority = f.priority;
    if (f.type) where.type = f.type;
    if (f.parentId !== undefined) where.parentId = f.parentId;
    if (f.tag?.trim()) where.tags = { has: f.tag.trim().toLowerCase() };
    if (f.overdue) {
      where.dueDate = { lt: new Date(new Date().toISOString().slice(0, 10)) };
      where.status = { category: { not: 'DONE' } };
    }
    if (f.sprintId === 'none') where.sprintId = null;
    else if (typeof f.sprintId === 'number') where.sprintId = f.sprintId;
    if (f.board) {
      // Tablero: tarjetas = trabajo real. Sin épicas; sin subtareas de tareas (se ven dentro del padre).
      where.type = f.type ?? { not: 'EPIC' };
      where.OR = [{ parentId: null }, { parent: { type: 'EPIC' } }];
    }
    if (f.q?.trim()) {
      const q = f.q.trim();
      const clave = parsearClaveTarea(q);
      // Sin acentos ni mayúsculas ("guia" encuentra "guía"): unaccent() en la BD; si no estuviera, cae a contains.
      let ids: number[] | null = null;
      try {
        const rows = await this.prisma.$queryRaw<{ id: number }[]>`SELECT id FROM task WHERE unaccent(title) ILIKE unaccent(${'%' + q + '%'}) LIMIT 2000`;
        ids = rows.map((r) => r.id);
      } catch {
        ids = null;
      }
      where.AND = [
        {
          OR: [
            ids ? { id: { in: ids } } : { title: { contains: q, mode: 'insensitive' } },
            ...(clave ? [{ number: clave.number, project: { key: clave.projectKey } }] : []),
            ...(/^\d+$/.test(q) ? [{ number: Number(q) }] : []),
          ],
        },
      ];
    }
    if (!f.includeDone) where.status = { category: { not: 'DONE' } };
    else if (f.doneDays) {
      const desde = new Date(Date.now() - f.doneDays * 86_400_000);
      where.AND = [...((where.AND as Prisma.TaskWhereInput[]) ?? []), { OR: [{ status: { category: { not: 'DONE' } } }, { closedAt: { gte: desde } }] }];
    }

    const pageSize = Math.min(Math.max(f.pageSize ?? 500, 1), 1000);
    const page = Math.max(f.page ?? 1, 1);
    const [total, rows] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: includeTask,
        orderBy: [{ status: { order: 'asc' } }, { order: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: await this.toDtos(rows), total, page, pageSize };
  }

  /** `userId`: si se da, una tarea de un proyecto que no ve se comporta como inexistente. */
  async get(id: number, userId?: number): Promise<TaskDto> {
    const row = await this.prisma.task.findUnique({ where: { id }, include: includeTask });
    if (!row) throw new NotFoundException('Tarea no encontrada.');
    if (userId !== undefined) await this.access.assertProjectVisible(userId, row.projectId, 'Tarea');
    return (await this.toDtos([row]))[0];
  }

  async getByKey(key: string, userId?: number): Promise<TaskDto> {
    const parsed = parsearClaveTarea(key);
    if (!parsed) throw new BadRequestException(`Clave de tarea inválida: ${key}.`);
    const project = await this.prisma.project.findUnique({ where: { key: parsed.projectKey }, select: { id: true } });
    if (!project) throw new NotFoundException('Tarea no encontrada.');
    if (userId !== undefined) await this.access.assertProjectVisible(userId, project.id, 'Tarea');
    const row = await this.prisma.task.findUnique({ where: { projectId_number: { projectId: project.id, number: parsed.number } }, include: includeTask });
    if (!row) throw new NotFoundException('Tarea no encontrada.');
    return (await this.toDtos([row]))[0];
  }

  async subtasks(parentId: number): Promise<TaskDto[]> {
    const rows = await this.prisma.task.findMany({ where: { parentId }, include: includeTask, orderBy: [{ status: { order: 'asc' } }, { order: 'asc' }] });
    return this.toDtos(rows);
  }

  /** Resumen para la pantalla de inicio (sólo proyectos visibles para quien pregunta). */
  async resumen(userId: number): Promise<ResumenDto> {
    const vis = await this.access.visibleProjectIds(userId);
    const visibles: Prisma.TaskWhereInput = vis ? { projectId: { in: vis } } : {};
    const abiertas: Prisma.TaskWhereInput = { ...visibles, assigneeId: userId, status: { category: { not: 'DONE' } } };
    const hoy = new Date(new Date().toISOString().slice(0, 10));
    const d7 = new Date(Date.now() - 7 * 86_400_000);
    const d14 = new Date(Date.now() - 14 * 86_400_000);
    const [misAbiertas, misVencidas, proyectos, proximasRows, misEnCurso, misHechas7d, misHechas7dPrev, misNuevas7d, sprintActivo] = await Promise.all([
      this.prisma.task.count({ where: abiertas }),
      this.prisma.task.count({ where: { ...abiertas, dueDate: { lt: hoy } } }),
      this.prisma.project.findMany({ where: { archived: false, ...(vis ? { id: { in: vis } } : {}) }, orderBy: { name: 'asc' }, select: { id: true, key: true, name: true, color: true } }),
      this.prisma.task.findMany({ where: abiertas, include: includeTask, orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { priority: 'asc' }], take: 8 }),
      this.prisma.task.count({ where: { assigneeId: userId, status: { category: 'DOING', NOT: { key: { contains: 'bloq' } } } } }),
      this.prisma.task.count({ where: { assigneeId: userId, closedAt: { gte: d7 } } }),
      this.prisma.task.count({ where: { assigneeId: userId, closedAt: { gte: d14, lt: d7 } } }),
      this.prisma.task.count({ where: { assigneeId: userId, createdAt: { gte: d7 } } }),
      this.prisma.sprint.findFirst({ where: { status: 'ACTIVE' }, orderBy: [{ projectId: { sort: 'asc', nulls: 'first' } }, { endDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }], include: { tasks: { where: { assigneeId: userId }, select: { status: { select: { category: true } } } } } }),
    ]);
    const miSprint = sprintActivo
      ? {
          id: sprintActivo.id,
          name: sprintActivo.name,
          total: sprintActivo.tasks.length,
          done: sprintActivo.tasks.filter((t) => t.status.category === 'DONE').length,
          daysLeft: sprintActivo.endDate ? Math.max(0, Math.ceil((sprintActivo.endDate.getTime() - hoy.getTime()) / 86_400_000)) : null,
        }
      : null;
    const open = await this.prisma.task.groupBy({ by: ['projectId'], where: { ...visibles, status: { category: { not: 'DONE' } } }, _count: { _all: true } });
    const mine = await this.prisma.task.groupBy({ by: ['projectId'], where: abiertas, _count: { _all: true } });
    const o = new Map(open.map((x) => [x.projectId, x._count._all]));
    const m = new Map(mine.map((x) => [x.projectId, x._count._all]));
    return {
      misAbiertas,
      misEnCurso,
      misVencidas,
      misHechas7d,
      misHechas7dPrev,
      misNuevas7d,
      miSprint,
      porProyecto: proyectos.map((p) => ({ projectId: p.id, key: p.key, name: p.name, color: p.color, open: o.get(p.id) ?? 0, mine: m.get(p.id) ?? 0 })),
      proximas: await this.toDtos(proximasRows),
    };
  }

  // ---------- Escritura ----------

  async create(dto: CreateTaskDto, actorId: number): Promise<TaskDto> {
    const title = dto.title?.trim();
    if (!title) throw new BadRequestException('Indica el título de la tarea.');
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId }, include: { statuses: { orderBy: { order: 'asc' } } } });
    if (!project) throw new BadRequestException('Proyecto no encontrado.');
    if (project.statuses.length === 0) throw new BadRequestException('El proyecto no tiene estados.');
    const status = dto.statusId ? project.statuses.find((s) => s.id === dto.statusId) : project.statuses[0];
    if (!status) throw new BadRequestException('Estado no válido para este proyecto.');
    if (dto.type && !TASK_TYPES.includes(dto.type)) throw new BadRequestException('Tipo no válido.');
    if (dto.priority && !PRIORITIES.includes(dto.priority)) throw new BadRequestException('Prioridad no válida.');
    if (dto.parentId) await this.ensureParent(dto.parentId, project.id, null);
    if (dto.assigneeId) await this.ensureUser(dto.assigneeId);
    if (dto.sprintId) await this.ensureSprint(dto.sprintId, project.id);

    const id = await this.prisma.$transaction(async (tx) => {
      // El número se reserva en la MISMA transacción: dos altas a la vez no pueden compartir COOL-<n>.
      const p = await tx.project.update({ where: { id: project.id }, data: { nextNumber: { increment: 1 } }, select: { nextNumber: true } });
      const last = await tx.task.aggregate({ where: { statusId: status.id }, _max: { order: true } });
      const t = await tx.task.create({
        data: {
          projectId: project.id,
          number: p.nextNumber - 1,
          title,
          description: dto.description ?? '',
          type: dto.type ?? 'TASK',
          statusId: status.id,
          priority: dto.priority ?? 'NORMAL',
          assigneeId: dto.assigneeId ?? null,
          reporterId: actorId,
          parentId: dto.parentId ?? null,
          sprintId: dto.sprintId ?? null,
          dueDate: parseFecha(dto.dueDate) ?? null,
          startDate: parseFecha(dto.startDate) ?? null,
          tags: limpiarTags(dto.tags),
          estimate: limpiarEstimacion(dto.estimate),
          recurrence: dto.recurrence && RECURRENCES.includes(dto.recurrence) ? dto.recurrence : 'NONE',
          order: (last._max.order ?? -1) + 1,
          closedAt: status.category === 'DONE' ? new Date() : null,
        },
      });
      await this.activity.record({ taskId: t.id, actorId, action: 'created', after: title }, tx);
      if (t.assigneeId) await this.notifications.notify([t.assigneeId], 'ASSIGNED', `te asignó ${claveTarea(project.key, t.number)} · ${title}`, { taskId: t.id, actorId }, tx);
      return t.id;
    });
    return this.get(id);
  }

  async update(id: number, dto: UpdateTaskDto, actorId: number): Promise<TaskDto> {
    const cur = await this.prisma.task.findUnique({ where: { id }, include: { status: true, assignee: userRef, parent: { select: { id: true, number: true, project: { select: { key: true } } } }, project: { select: { key: true } }, sprint: { select: { id: true, name: true } } } });
    if (!cur) throw new NotFoundException('Tarea no encontrada.');

    const data: Prisma.TaskUncheckedUpdateInput = {};
    const cambios: ActivityInput[] = [];
    const log = (field: string, before: string | null, after: string | null) => cambios.push({ taskId: id, actorId, action: field, field, before, after });

    if (dto.title !== undefined) {
      const t = dto.title.trim();
      if (!t) throw new BadRequestException('El título no puede quedar vacío.');
      if (t !== cur.title) {
        data.title = t;
        log('title', cur.title, t);
      }
    }
    if (dto.description !== undefined && dto.description !== cur.description) {
      data.description = dto.description;
      log('description', null, null);
    }
    if (dto.type !== undefined && dto.type !== cur.type) {
      if (!TASK_TYPES.includes(dto.type)) throw new BadRequestException('Tipo no válido.');
      data.type = dto.type;
      log('type', TASK_TYPE_LABELS[cur.type], TASK_TYPE_LABELS[dto.type]);
    }
    if (dto.priority !== undefined && dto.priority !== cur.priority) {
      if (!PRIORITIES.includes(dto.priority)) throw new BadRequestException('Prioridad no válida.');
      data.priority = dto.priority;
      log('priority', PRIORITY_LABELS[cur.priority], PRIORITY_LABELS[dto.priority]);
    }
    if (dto.statusId !== undefined && dto.statusId !== cur.statusId) {
      const st = await this.prisma.projectStatus.findFirst({ where: { id: dto.statusId, projectId: cur.projectId } });
      if (!st) throw new BadRequestException('Estado no válido para este proyecto.');
      const last = await this.prisma.task.aggregate({ where: { statusId: st.id }, _max: { order: true } });
      data.statusId = st.id;
      data.order = (last._max.order ?? -1) + 1;
      data.closedAt = st.category === 'DONE' ? new Date() : null;
      log('status', cur.status.name, st.name);
    }
    if (dto.assigneeId !== undefined && dto.assigneeId !== cur.assigneeId) {
      const nuevo = dto.assigneeId ? await this.ensureUser(dto.assigneeId) : null;
      data.assigneeId = nuevo?.id ?? null;
      log('assignee', cur.assignee?.name ?? null, nuevo?.name ?? null);
    }
    if (dto.parentId !== undefined && dto.parentId !== cur.parentId) {
      if (dto.parentId) await this.ensureParent(dto.parentId, cur.projectId, id);
      data.parentId = dto.parentId ?? null;
      const antes = cur.parent ? claveTarea(cur.parent.project.key, cur.parent.number) : null;
      const despues = dto.parentId ? await this.claveDe(dto.parentId) : null;
      log('parent', antes, despues);
    }
    if (dto.sprintId !== undefined && dto.sprintId !== cur.sprintId) {
      const sp = dto.sprintId ? await this.ensureSprint(dto.sprintId, cur.projectId) : null;
      data.sprintId = sp?.id ?? null;
      log('sprint', cur.sprint?.name ?? null, sp?.name ?? null);
    }
    const due = parseFecha(dto.dueDate);
    if (due !== undefined && fecha(due) !== fecha(cur.dueDate)) {
      data.dueDate = due;
      log('dueDate', fecha(cur.dueDate), fecha(due));
    }
    const start = parseFecha(dto.startDate);
    if (start !== undefined && fecha(start) !== fecha(cur.startDate)) {
      data.startDate = start;
      log('startDate', fecha(cur.startDate), fecha(start));
    }
    if (dto.estimate !== undefined) {
      const est = limpiarEstimacion(dto.estimate);
      if (est !== cur.estimate) {
        data.estimate = est;
        log('estimate', cur.estimate === null ? null : String(cur.estimate), est === null ? null : String(est));
      }
    }
    if (dto.recurrence !== undefined && dto.recurrence !== cur.recurrence) {
      if (!RECURRENCES.includes(dto.recurrence)) throw new BadRequestException('Repetición no válida.');
      data.recurrence = dto.recurrence;
      log('recurrence', cur.recurrence, dto.recurrence);
    }
    if (dto.tags !== undefined) {
      const tags = limpiarTags(dto.tags);
      if (tags.join('|') !== cur.tags.join('|')) {
        data.tags = tags;
        log('tags', cur.tags.join(', ') || null, tags.join(', ') || null);
      }
    }

    if (Object.keys(data).length === 0) return this.get(id);
    const clave = claveTarea(cur.project.key, cur.number);
    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data });
      await this.activity.record(cambios, tx);
      if (data.assigneeId !== undefined && data.assigneeId) {
        await this.notifications.notify([data.assigneeId as number], 'ASSIGNED', `te asignó ${clave} · ${cur.title}`, { taskId: id, actorId }, tx);
      }
      if (data.statusId !== undefined) {
        const nuevo = cambios.find((c) => c.field === 'status');
        await this.notifications.notify([cur.assigneeId, cur.reporterId], 'STATUS', `pasó ${clave} a ${nuevo?.after ?? 'otro estado'}`, { taskId: id, actorId }, tx);
      }
    });
    if (data.closedAt instanceof Date) await this.alTerminar(id, actorId);
    return this.get(id);
  }

  /** Mover en el tablero (columna + posición). Escribe una fila; renumera la columna sólo si el hueco se agotó. */
  async move(id: number, dto: MoveTaskDto, actorId: number): Promise<TaskDto> {
    const cur = await this.prisma.task.findUnique({ where: { id }, include: { status: true, project: { select: { key: true } } } });
    if (!cur) throw new NotFoundException('Tarea no encontrada.');
    const st = await this.prisma.projectStatus.findFirst({ where: { id: dto.statusId, projectId: cur.projectId } });
    if (!st) throw new BadRequestException('Estado no válido para este proyecto.');

    const vecinas = await this.prisma.task.findMany({
      where: { statusId: st.id, id: { not: id }, type: { not: 'EPIC' } },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: { id: true, order: true },
    });
    const { order, renumerar: hayQueRenumerar } = ordenPara(vecinas.map((v) => v.order), dto.index ?? vecinas.length);

    await this.prisma.$transaction(async (tx) => {
      if (hayQueRenumerar) {
        const ids = vecinas.map((v) => v.id);
        ids.splice(Math.max(0, Math.min(dto.index, ids.length)), 0, id);
        for (const r of renumerar(ids)) await tx.task.update({ where: { id: r.id }, data: { order: r.order, ...(r.id === id ? { statusId: st.id } : {}) } });
      } else {
        await tx.task.update({ where: { id }, data: { statusId: st.id, order } });
      }
      if (st.id !== cur.statusId) {
        await tx.task.update({ where: { id }, data: { closedAt: st.category === 'DONE' ? new Date() : null } });
        await this.activity.record({ taskId: id, actorId, action: 'status', field: 'status', before: cur.status.name, after: st.name }, tx);
        await this.notifications.notify([cur.assigneeId, cur.reporterId], 'STATUS', `pasó ${claveTarea(cur.project.key, cur.number)} a ${st.name}`, { taskId: id, actorId }, tx);
      }
    });
    if (st.id !== cur.statusId && st.category === 'DONE') await this.alTerminar(id, actorId);
    return this.get(id);
  }

  /** Al terminar una tarea: avisa a quienes esperaban por ella y, si se repite, crea la siguiente ocurrencia. */
  private async alTerminar(id: number, actorId: number): Promise<void> {
    const t = await this.prisma.task.findUnique({ where: { id }, include: { project: { select: { key: true, statuses: { orderBy: { order: 'asc' } } } }, blocks: { include: { blocked: { select: { id: true, assigneeId: true, number: true, title: true, project: { select: { key: true } } } } } } } });
    if (!t) return;
    const clave = claveTarea(t.project.key, t.number);
    for (const d of t.blocks) {
      await this.notifications.notify([d.blocked.assigneeId], 'BLOCKER_DONE', `terminó ${clave}, que bloqueaba ${claveTarea(d.blocked.project.key, d.blocked.number)} · ${d.blocked.title}`, { taskId: d.blocked.id, actorId });
    }
    if (t.recurrence !== 'NONE') {
      const base = t.dueDate ?? new Date(new Date().toISOString().slice(0, 10));
      const next = new Date(base);
      if (t.recurrence === 'DAILY') next.setUTCDate(next.getUTCDate() + 1);
      else if (t.recurrence === 'WEEKLY') next.setUTCDate(next.getUTCDate() + 7);
      else next.setUTCMonth(next.getUTCMonth() + 1);
      // La cerrada deja de repetirse (si se reabre no vuelve a generar); la nueva hereda la repetición.
      await this.prisma.task.update({ where: { id }, data: { recurrence: 'NONE' } });
      const primero = t.project.statuses.find((s) => s.category === 'TODO') ?? t.project.statuses[0];
      await this.create(
        {
          projectId: t.projectId,
          title: t.title,
          description: t.description,
          type: t.type,
          statusId: primero?.id,
          priority: t.priority,
          assigneeId: t.assigneeId,
          parentId: t.parentId,
          sprintId: null,
          dueDate: next.toISOString().slice(0, 10),
          tags: t.tags,
          estimate: t.estimate,
          recurrence: t.recurrence,
        },
        actorId,
      );
    }
  }

  // ---------- KPIs de equipo ----------

  async kpis(): Promise<KpisDto> {
    const ahora = new Date();
    const hoy = new Date(ahora.toISOString().slice(0, 10));
    const d7 = new Date(ahora.getTime() - 7 * 86_400_000);
    const d14 = new Date(ahora.getTime() - 14 * 86_400_000);
    const d30 = new Date(ahora.getTime() - 30 * 86_400_000);
    const abiertas: Prisma.TaskWhereInput = { status: { category: { not: 'DONE' } } };
    const enCurso: Prisma.TaskWhereInput = { status: { category: 'DOING', NOT: { key: { contains: 'bloq' } } } };
    const [open, doing, bloqEstado, unassigned, overdue, stale, urgentOpen, done7d, done7dPrev, created7d, done30d, created30d, bloqDeps] = await Promise.all([
      this.prisma.task.count({ where: abiertas }),
      this.prisma.task.count({ where: enCurso }),
      this.prisma.task.count({ where: { status: { category: 'DOING', key: { contains: 'bloq' } } } }),
      this.prisma.task.count({ where: { ...abiertas, assigneeId: null, type: { not: 'EPIC' } } }),
      this.prisma.task.count({ where: { ...abiertas, dueDate: { lt: hoy } } }),
      this.prisma.task.count({ where: { ...abiertas, updatedAt: { lt: d30 }, type: { not: 'EPIC' } } }),
      this.prisma.task.count({ where: { ...abiertas, priority: 'URGENT' } }),
      this.prisma.task.count({ where: { closedAt: { gte: d7 } } }),
      this.prisma.task.count({ where: { closedAt: { gte: d14, lt: d7 } } }),
      this.prisma.task.count({ where: { createdAt: { gte: d7 } } }),
      this.prisma.task.count({ where: { closedAt: { gte: d30 } } }),
      this.prisma.task.count({ where: { createdAt: { gte: d30 } } }),
      this.prisma.taskDependency.findMany({ where: { blocked: abiertas, blocker: abiertas }, select: { blockedId: true }, distinct: ['blockedId'] }),
    ]);
    const cerradas30 = await this.prisma.task.findMany({ where: { closedAt: { gte: d30 } }, select: { createdAt: true, closedAt: true } });
    const leads = cerradas30.map((t) => ((t.closedAt as Date).getTime() - t.createdAt.getTime()) / 86_400_000).sort((a, b) => a - b);
    const leadTimeDays = leads.length ? Math.round(leads[Math.floor(leads.length / 2)] * 10) / 10 : null;
    const abiertasRows = await this.prisma.task.findMany({ where: { ...abiertas, type: { not: 'EPIC' } }, select: { createdAt: true } });
    const avgAgeDays = abiertasRows.length ? Math.round(abiertasRows.reduce((n, t) => n + (ahora.getTime() - t.createdAt.getTime()) / 86_400_000, 0) / abiertasRows.length) : null;

    // Sprint activo (el primero en curso; si hay varios, el que antes termina).
    const sp = await this.prisma.sprint.findFirst({ where: { status: 'ACTIVE' }, orderBy: [{ projectId: { sort: 'asc', nulls: 'first' } }, { endDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }], include: { tasks: { select: { estimate: true, status: { select: { category: true } } } } } });
    const activeSprint = sp
      ? {
          id: sp.id,
          name: sp.name,
          total: sp.tasks.length,
          done: sp.tasks.filter((t) => t.status.category === 'DONE').length,
          points: sp.tasks.reduce((n, t) => n + (t.estimate ?? 0), 0),
          pointsDone: sp.tasks.filter((t) => t.status.category === 'DONE').reduce((n, t) => n + (t.estimate ?? 0), 0),
          daysLeft: sp.endDate ? Math.max(0, Math.ceil((sp.endDate.getTime() - hoy.getTime()) / 86_400_000)) : null,
        }
      : null;

    // Por persona (activas + las que tengan algo).
    const users = await this.prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } });
    const [pOpen, pDoing, pOverdue, pDone7] = await Promise.all([
      this.prisma.task.groupBy({ by: ['assigneeId'], where: abiertas, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['assigneeId'], where: enCurso, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['assigneeId'], where: { ...abiertas, dueDate: { lt: hoy } }, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['assigneeId'], where: { closedAt: { gte: d7 } }, _count: { _all: true } }),
    ]);
    const m = (g: { assigneeId: number | null; _count: { _all: number } }[]) => new Map(g.map((x) => [x.assigneeId, x._count._all]));
    const [mo, md, mv, m7] = [m(pOpen), m(pDoing), m(pOverdue), m(pDone7)];
    const porPersona = users
      .map((u) => ({ user: u, open: mo.get(u.id) ?? 0, doing: md.get(u.id) ?? 0, overdue: mv.get(u.id) ?? 0, done7d: m7.get(u.id) ?? 0 }))
      .filter((p) => p.open + p.done7d > 0)
      .sort((a, b) => b.open - a.open || b.done7d - a.done7d);

    // Por proyecto.
    const projects = await this.prisma.project.findMany({ where: { archived: false }, orderBy: { name: 'asc' }, select: { id: true, key: true, name: true, color: true } });
    const [gOpen, gDoing, gOverdue, gDone7, gCreated7] = await Promise.all([
      this.prisma.task.groupBy({ by: ['projectId'], where: abiertas, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['projectId'], where: enCurso, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['projectId'], where: { ...abiertas, dueDate: { lt: hoy } }, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['projectId'], where: { closedAt: { gte: d7 } }, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['projectId'], where: { createdAt: { gte: d7 } }, _count: { _all: true } }),
    ]);
    const mp = (g: { projectId: number; _count: { _all: number } }[]) => new Map(g.map((x) => [x.projectId, x._count._all]));
    const [po, pd, pv, p7, pc7] = [mp(gOpen), mp(gDoing), mp(gOverdue), mp(gDone7), mp(gCreated7)];
    const porProyecto = projects.map((p) => ({ projectId: p.id, key: p.key, name: p.name, color: p.color, open: po.get(p.id) ?? 0, doing: pd.get(p.id) ?? 0, overdue: pv.get(p.id) ?? 0, done7d: p7.get(p.id) ?? 0, created7d: pc7.get(p.id) ?? 0 }));

    // Últimas 8 semanas (lunes a domingo): creadas y terminadas.
    const lunes = (d: Date) => {
      const x = new Date(d.toISOString().slice(0, 10));
      const wd = (x.getUTCDay() + 6) % 7;
      x.setUTCDate(x.getUTCDate() - wd);
      return x;
    };
    const inicio = lunes(new Date(ahora.getTime() - 7 * 7 * 86_400_000));
    const [creadas, cerradas] = await Promise.all([
      this.prisma.task.findMany({ where: { createdAt: { gte: inicio } }, select: { createdAt: true } }),
      this.prisma.task.findMany({ where: { closedAt: { gte: inicio } }, select: { closedAt: true } }),
    ]);
    const semanas: KpisDto['semanas'] = [];
    for (let i = 0; i < 8; i++) {
      const w0 = new Date(inicio.getTime() + i * 7 * 86_400_000);
      const w1 = new Date(w0.getTime() + 7 * 86_400_000);
      semanas.push({
        week: w0.toISOString().slice(0, 10),
        created: creadas.filter((t) => t.createdAt >= w0 && t.createdAt < w1).length,
        done: cerradas.filter((t) => (t.closedAt as Date) >= w0 && (t.closedAt as Date) < w1).length,
      });
    }

    return { open, doing, blocked: bloqEstado + bloqDeps.length, unassigned, overdue, stale, urgentOpen, done7d, done7dPrev, created7d, done30d, created30d, leadTimeDays, avgAgeDays, activeSprint, porPersona, porProyecto, semanas };
  }

  // ---------- Dependencias ----------

  async dependencies(id: number): Promise<DependenciesDto> {
    const t = await this.prisma.task.findUnique({
      where: { id },
      include: { blockedBy: { include: { blocker: { include: refInclude } } }, blocks: { include: { blocked: { include: refInclude } } } },
    });
    if (!t) throw new NotFoundException('Tarea no encontrada.');
    return { blockedBy: t.blockedBy.map((d) => toRef(d.blocker)), blocks: t.blocks.map((d) => toRef(d.blocked)) };
  }

  /** `id` queda bloqueada por `blockerKey` (clave COOL-12 o id). Sin ciclos. */
  async addDependency(id: number, blockerKey: string, actorId: number): Promise<DependenciesDto> {
    const blocker = /^\d+$/.test(blockerKey) ? await this.prisma.task.findUnique({ where: { id: Number(blockerKey) } }) : await this.porClave(blockerKey);
    if (!blocker) throw new BadRequestException(`No encuentro la tarea ${blockerKey}.`);
    if (blocker.id === id) throw new BadRequestException('Una tarea no puede bloquearse a sí misma.');
    if (await this.dependeDe(blocker.id, id)) throw new BadRequestException('Eso crearía un ciclo: esa tarea ya depende de ésta.');
    const ya = await this.prisma.taskDependency.findUnique({ where: { blockerId_blockedId: { blockerId: blocker.id, blockedId: id } } });
    if (!ya) {
      await this.prisma.taskDependency.create({ data: { blockerId: blocker.id, blockedId: id } });
      await this.activity.record({ taskId: id, actorId, action: 'dependency', field: 'dependency', before: null, after: await this.claveDe(blocker.id) });
    }
    return this.dependencies(id);
  }

  async removeDependency(id: number, blockerId: number, actorId: number): Promise<DependenciesDto> {
    const d = await this.prisma.taskDependency.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId: id } } });
    if (d) {
      await this.prisma.taskDependency.delete({ where: { id: d.id } });
      await this.activity.record({ taskId: id, actorId, action: 'dependency', field: 'dependency', before: await this.claveDe(blockerId), after: null });
    }
    return this.dependencies(id);
  }

  /** ¿`a` depende (directa o indirectamente) de `b`? */
  private async dependeDe(a: number, b: number): Promise<boolean> {
    const vistos = new Set<number>();
    let frente = [a];
    while (frente.length) {
      const deps = await this.prisma.taskDependency.findMany({ where: { blockedId: { in: frente } }, select: { blockerId: true } });
      const next: number[] = [];
      for (const d of deps) {
        if (d.blockerId === b) return true;
        if (!vistos.has(d.blockerId)) {
          vistos.add(d.blockerId);
          next.push(d.blockerId);
        }
      }
      frente = next;
    }
    return false;
  }

  private async porClave(key: string) {
    const parsed = parsearClaveTarea(key);
    if (!parsed) return null;
    const project = await this.prisma.project.findUnique({ where: { key: parsed.projectKey } });
    if (!project) return null;
    return this.prisma.task.findUnique({ where: { projectId_number: { projectId: project.id, number: parsed.number } } });
  }

  /** Copia de una tarea (título con «(copia)», mismo proyecto/estado inicial, sin comentarios ni adjuntos). */
  async duplicate(id: number, actorId: number): Promise<TaskDto> {
    const cur = await this.prisma.task.findUnique({ where: { id }, include: { project: { select: { statuses: { orderBy: { order: 'asc' } } } } } });
    if (!cur) throw new NotFoundException('Tarea no encontrada.');
    const primero = cur.project.statuses.find((s) => s.category !== 'DONE') ?? cur.project.statuses[0];
    return this.create(
      {
        projectId: cur.projectId,
        title: `${cur.title} (copia)`,
        description: cur.description,
        type: cur.type,
        statusId: primero?.id,
        priority: cur.priority,
        assigneeId: cur.assigneeId,
        parentId: cur.parentId,
        sprintId: cur.sprintId,
        dueDate: fecha(cur.dueDate),
        startDate: fecha(cur.startDate),
        tags: cur.tags,
        estimate: cur.estimate,
      },
      actorId,
    );
  }

  /** Etiquetas en uso (con cuántas tareas cada una), opcionalmente de un proyecto. */
  async tags(projectId?: number): Promise<TagCountDto[]> {
    const rows = projectId
      ? await this.prisma.$queryRaw<{ tag: string; count: bigint }[]>`SELECT t.tag, COUNT(*)::bigint AS count FROM task, unnest(task.tags) AS t(tag) WHERE task.project_id = ${projectId} GROUP BY t.tag ORDER BY count DESC, t.tag ASC`
      : await this.prisma.$queryRaw<{ tag: string; count: bigint }[]>`SELECT t.tag, COUNT(*)::bigint AS count FROM task, unnest(task.tags) AS t(tag) GROUP BY t.tag ORDER BY count DESC, t.tag ASC`;
    return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
  }

  async remove(id: number): Promise<void> {
    if (!(await this.prisma.task.findUnique({ where: { id } }))) throw new NotFoundException('Tarea no encontrada.');
    await this.prisma.task.delete({ where: { id } });
  }

  // ---------- Internos ----------

  private async ensureUser(id: number): Promise<{ id: number; name: string }> {
    const u = await this.prisma.user.findFirst({ where: { id, active: true }, select: { id: true, name: true } });
    if (!u) throw new BadRequestException('Usuario no válido.');
    return u;
  }

  /** El sprint debe estar abierto y admitir la tarea: de su proyecto, o del equipo de su proyecto, o global. */
  private async ensureSprint(id: number, projectId: number): Promise<{ id: number; name: string }> {
    const sp = await this.prisma.sprint.findFirst({ where: { id, status: { not: 'CLOSED' } }, select: { id: true, name: true, projectId: true, teamId: true, project: { select: { key: true } }, team: { select: { name: true } } } });
    if (!sp) throw new BadRequestException('Sprint no válido (no existe o está cerrado).');
    if (sp.projectId && sp.projectId !== projectId) throw new BadRequestException(`El sprint "${sp.name}" es sólo del proyecto ${sp.project?.key}: esta tarea no puede entrar en él.`);
    if (sp.teamId) {
      const p = await this.prisma.project.findUnique({ where: { id: projectId }, select: { teamId: true } });
      if (p?.teamId !== sp.teamId) throw new BadRequestException(`El sprint "${sp.name}" es del equipo ${sp.team?.name}: sólo admite tareas de sus proyectos.`);
    }
    return { id: sp.id, name: sp.name };
  }

  private async ensureParent(parentId: number, projectId: number, selfId: number | null): Promise<void> {
    if (parentId === selfId) throw new BadRequestException('Una tarea no puede ser su propio padre.');
    const p = await this.prisma.task.findFirst({ where: { id: parentId, projectId }, select: { id: true, parentId: true } });
    if (!p) throw new BadRequestException('El padre debe ser una tarea del mismo proyecto.');
    if (selfId && p.parentId === selfId) throw new BadRequestException('Ese padre es hijo de esta tarea.');
  }

  private async claveDe(id: number): Promise<string> {
    const t = await this.prisma.task.findUnique({ where: { id }, select: { number: true, project: { select: { key: true } } } });
    return t ? claveTarea(t.project.key, t.number) : String(id);
  }

  private async toDtos(rows: TaskRow[]): Promise<TaskDto[]> {
    // Subtareas hechas: una consulta para todas las filas, no una por tarea.
    const ids = rows.filter((r) => r._count.subtasks > 0).map((r) => r.id);
    const hechas = new Map<number, number>();
    if (ids.length) {
      const subs = await this.prisma.task.findMany({ where: { parentId: { in: ids }, status: { category: 'DONE' } }, select: { parentId: true } });
      for (const s of subs) hechas.set(s.parentId as number, (hechas.get(s.parentId as number) ?? 0) + 1);
    }
    // Bloqueos vivos: cuántas tareas sin terminar bloquean a cada fila.
    const bloqueos = new Map<number, number>();
    if (rows.length) {
      const deps = await this.prisma.taskDependency.findMany({ where: { blockedId: { in: rows.map((r) => r.id) }, blocker: { status: { category: { not: 'DONE' } } } }, select: { blockedId: true } });
      for (const d of deps) bloqueos.set(d.blockedId, (bloqueos.get(d.blockedId) ?? 0) + 1);
    }
    return rows.map((r) => ({
      id: r.id,
      key: claveTarea(r.project.key, r.number),
      number: r.number,
      projectId: r.projectId,
      projectKey: r.project.key,
      title: r.title,
      description: r.description,
      type: r.type,
      status: statusToDto(r.status),
      priority: r.priority,
      assignee: r.assignee,
      reporter: r.reporter,
      parentId: r.parentId,
      parentKey: r.parent ? claveTarea(r.parent.project.key, r.parent.number) : null,
      parentTitle: r.parent?.title ?? null,
      sprintId: r.sprint?.id ?? null,
      sprintName: r.sprint?.name ?? null,
      dueDate: fecha(r.dueDate),
      startDate: fecha(r.startDate),
      tags: r.tags,
      estimate: r.estimate,
      recurrence: r.recurrence,
      blockedByOpenCount: bloqueos.get(r.id) ?? 0,
      order: r.order,
      closedAt: r.closedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      subtaskCount: r._count.subtasks,
      doneSubtaskCount: hechas.get(r.id) ?? 0,
      commentCount: r._count.comments,
      attachmentCount: r._count.attachments,
      clickupUrl: r.clickupUrl,
    }));
  }
}

/** Puntos: entero 0-999 o null. */
function limpiarEstimacion(v: number | null | undefined): number | null {
  if (v === undefined || v === null || v === ('' as unknown)) return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0) throw new BadRequestException('La estimación debe ser un número de puntos (0 o más).');
  return Math.min(n, 999);
}

function limpiarTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

const refInclude = { status: true, assignee: { select: { id: true, name: true, email: true } }, project: { select: { key: true } } } satisfies Prisma.TaskInclude;
type RefRow = Prisma.TaskGetPayload<{ include: typeof refInclude }>;
function toRef(r: RefRow): TaskRefDto {
  return { id: r.id, key: claveTarea(r.project.key, r.number), title: r.title, done: r.status.category === 'DONE', status: statusToDto(r.status), assignee: r.assignee };
}
