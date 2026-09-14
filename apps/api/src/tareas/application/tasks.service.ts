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
} from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { claveTarea, parsearClaveTarea } from '../domain/clave';
import { ordenPara, renumerar } from '../domain/orden';
import { ActivityInput, ActivityService } from './activity.service';
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
  ) {}

  // ---------- Lectura ----------

  async list(f: TaskFilter, userId: number): Promise<TaskPageDto> {
    const where: Prisma.TaskWhereInput = {};
    if (f.projectId) where.projectId = f.projectId;
    if (f.statusId) where.statusId = f.statusId;
    if (f.assigneeId === 'me') where.assigneeId = userId;
    else if (f.assigneeId === 'none') where.assigneeId = null;
    else if (typeof f.assigneeId === 'number') where.assigneeId = f.assigneeId;
    if (f.priority) where.priority = f.priority;
    if (f.type) where.type = f.type;
    if (f.parentId !== undefined) where.parentId = f.parentId;
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
      where.AND = [
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
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

  async get(id: number): Promise<TaskDto> {
    const row = await this.prisma.task.findUnique({ where: { id }, include: includeTask });
    if (!row) throw new NotFoundException('Tarea no encontrada.');
    return (await this.toDtos([row]))[0];
  }

  async getByKey(key: string): Promise<TaskDto> {
    const parsed = parsearClaveTarea(key);
    if (!parsed) throw new BadRequestException(`Clave de tarea inválida: ${key}.`);
    const project = await this.prisma.project.findUnique({ where: { key: parsed.projectKey }, select: { id: true } });
    if (!project) throw new NotFoundException('Tarea no encontrada.');
    const row = await this.prisma.task.findUnique({ where: { projectId_number: { projectId: project.id, number: parsed.number } }, include: includeTask });
    if (!row) throw new NotFoundException('Tarea no encontrada.');
    return (await this.toDtos([row]))[0];
  }

  async subtasks(parentId: number): Promise<TaskDto[]> {
    const rows = await this.prisma.task.findMany({ where: { parentId }, include: includeTask, orderBy: [{ status: { order: 'asc' } }, { order: 'asc' }] });
    return this.toDtos(rows);
  }

  /** Resumen para la pantalla de inicio. */
  async resumen(userId: number): Promise<ResumenDto> {
    const abiertas: Prisma.TaskWhereInput = { assigneeId: userId, status: { category: { not: 'DONE' } } };
    const hoy = new Date(new Date().toISOString().slice(0, 10));
    const [misAbiertas, misVencidas, proyectos, proximasRows] = await Promise.all([
      this.prisma.task.count({ where: abiertas }),
      this.prisma.task.count({ where: { ...abiertas, dueDate: { lt: hoy } } }),
      this.prisma.project.findMany({ where: { archived: false }, orderBy: { name: 'asc' }, select: { id: true, key: true, name: true, color: true } }),
      this.prisma.task.findMany({ where: abiertas, include: includeTask, orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { priority: 'asc' }], take: 8 }),
    ]);
    const open = await this.prisma.task.groupBy({ by: ['projectId'], where: { status: { category: { not: 'DONE' } } }, _count: { _all: true } });
    const mine = await this.prisma.task.groupBy({ by: ['projectId'], where: abiertas, _count: { _all: true } });
    const o = new Map(open.map((x) => [x.projectId, x._count._all]));
    const m = new Map(mine.map((x) => [x.projectId, x._count._all]));
    return {
      misAbiertas,
      misVencidas,
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
    if (dto.sprintId) await this.ensureSprint(dto.sprintId);

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
          order: (last._max.order ?? -1) + 1,
          closedAt: status.category === 'DONE' ? new Date() : null,
        },
      });
      await this.activity.record({ taskId: t.id, actorId, action: 'created', after: title }, tx);
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
      const sp = dto.sprintId ? await this.ensureSprint(dto.sprintId) : null;
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
    if (dto.tags !== undefined) {
      const tags = limpiarTags(dto.tags);
      if (tags.join('|') !== cur.tags.join('|')) {
        data.tags = tags;
        log('tags', cur.tags.join(', ') || null, tags.join(', ') || null);
      }
    }

    if (Object.keys(data).length === 0) return this.get(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data });
      await this.activity.record(cambios, tx);
    });
    return this.get(id);
  }

  /** Mover en el tablero (columna + posición). Escribe una fila; renumera la columna sólo si el hueco se agotó. */
  async move(id: number, dto: MoveTaskDto, actorId: number): Promise<TaskDto> {
    const cur = await this.prisma.task.findUnique({ where: { id }, include: { status: true } });
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
      }
    });
    return this.get(id);
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

  private async ensureSprint(id: number): Promise<{ id: number; name: string }> {
    const sp = await this.prisma.sprint.findFirst({ where: { id, status: { not: 'CLOSED' } }, select: { id: true, name: true } });
    if (!sp) throw new BadRequestException('Sprint no válido (no existe o está cerrado).');
    return sp;
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

function limpiarTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}
