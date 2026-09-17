import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Sprint } from '@prisma/client';
import { BurndownDto, CloseSprintDto, CreateSprintDto, SPRINT_STATUSES, SprintDto, UpdateSprintDto } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { ActivityService } from './activity.service';

const fecha = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);
const parseFecha = (s: string | null | undefined): Date | null | undefined => {
  if (s === undefined) return undefined;
  if (s === null || s === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestException(`Fecha inválida: ${s} (usa AAAA-MM-DD).`);
  return new Date(`${s}T00:00:00.000Z`);
};

const conProyecto = { project: { select: { id: true, key: true, name: true } } } as const;
type SprintRow = Prisma.SprintGetPayload<{ include: typeof conProyecto }>;

/** Sprints de trabajo: transversales (sin proyecto) o de un proyecto concreto. */
@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /**
   * Lista sprints. Con `projectId`, los que ADMITEN tareas de ese proyecto: los transversales y los suyos
   * (es lo que necesita cualquier selector de sprint dentro de un proyecto).
   */
  async list(includeClosed = false, projectId?: number): Promise<SprintDto[]> {
    const rows = await this.prisma.sprint.findMany({
      where: {
        ...(includeClosed ? {} : { status: { not: 'CLOSED' } }),
        ...(projectId ? { OR: [{ projectId: null }, { projectId }] } : {}),
      },
      include: conProyecto,
      orderBy: [{ status: 'asc' }, { projectId: { sort: 'asc', nulls: 'first' } }, { startDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
    });
    return this.toDtos(rows);
  }

  async get(id: number): Promise<SprintDto> {
    const row = await this.prisma.sprint.findUnique({ where: { id }, include: conProyecto });
    if (!row) throw new NotFoundException('Sprint no encontrado.');
    return (await this.toDtos([row]))[0];
  }

  async create(dto: CreateSprintDto): Promise<SprintDto> {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Indica el nombre del sprint.');
    const startDate = parseFecha(dto.startDate) ?? null;
    const endDate = parseFecha(dto.endDate) ?? null;
    if (startDate && endDate && endDate < startDate) throw new BadRequestException('El sprint no puede terminar antes de empezar.');
    const projectId = dto.projectId ? (await this.ensureProject(dto.projectId)).id : null;
    const row = await this.prisma.sprint.create({ data: { name, goal: dto.goal?.trim() ?? '', startDate, endDate, projectId } });
    return this.get(row.id);
  }

  async update(id: number, dto: UpdateSprintDto): Promise<SprintDto> {
    const cur = await this.prisma.sprint.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('Sprint no encontrado.');
    const data: Prisma.SprintUpdateInput = {};
    if (dto.name !== undefined) {
      const n = dto.name.trim();
      if (!n) throw new BadRequestException('El nombre no puede quedar vacío.');
      data.name = n;
    }
    if (dto.goal !== undefined) data.goal = dto.goal.trim();
    if (dto.projectId !== undefined && (dto.projectId ?? null) !== cur.projectId) {
      // Cambiar el ámbito: a un proyecto sólo si TODAS sus tareas son de ese proyecto; a transversal, siempre.
      if (dto.projectId) {
        const p = await this.ensureProject(dto.projectId);
        const fuera = await this.prisma.task.count({ where: { sprintId: id, projectId: { not: p.id } } });
        if (fuera > 0) throw new BadRequestException(`El sprint tiene ${fuera} tareas de otros proyectos: no puede pasar a ser sólo de ${p.key}.`);
        data.project = { connect: { id: p.id } };
      } else {
        data.project = { disconnect: true };
      }
    }
    const start = parseFecha(dto.startDate);
    if (start !== undefined) data.startDate = start;
    const end = parseFecha(dto.endDate);
    if (end !== undefined) data.endDate = end;
    const s = start === undefined ? cur.startDate : start;
    const e = end === undefined ? cur.endDate : end;
    if (s && e && e < s) throw new BadRequestException('El sprint no puede terminar antes de empezar.');
    if (dto.status !== undefined) {
      if (!SPRINT_STATUSES.includes(dto.status)) throw new BadRequestException('Estado de sprint no válido.');
      if (dto.status === 'CLOSED') throw new BadRequestException('Para cerrar un sprint usa la acción de cerrar (decide qué pasa con lo pendiente).');
      data.status = dto.status;
      if (cur.status === 'CLOSED') data.closedAt = null; // reabrir
    }
    await this.prisma.sprint.update({ where: { id }, data });
    return this.get(id);
  }

  /** Cierra el sprint; lo no terminado va a otro sprint (`moveOpenTo`) o al backlog (`null`). */
  async close(id: number, dto: CloseSprintDto, actorId: number): Promise<SprintDto> {
    const cur = await this.prisma.sprint.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('Sprint no encontrado.');
    if (cur.status === 'CLOSED') throw new BadRequestException('El sprint ya está cerrado.');
    let destino: Sprint | null = null;
    if (dto.moveOpenTo) {
      destino = await this.prisma.sprint.findUnique({ where: { id: dto.moveOpenTo } });
      if (!destino || destino.id === id || destino.status === 'CLOSED') throw new BadRequestException('Sprint de destino no válido.');
    }
    const abiertas = await this.prisma.task.findMany({ where: { sprintId: id, status: { category: { not: 'DONE' } } }, select: { id: true, projectId: true } });
    if (destino?.projectId && abiertas.some((t) => t.projectId !== destino!.projectId)) {
      throw new BadRequestException(`"${destino.name}" es un sprint de un solo proyecto y hay tareas abiertas de otros proyectos: elige un sprint transversal o el backlog.`);
    }
    await this.prisma.$transaction(async (tx) => {
      if (abiertas.length) {
        await tx.task.updateMany({ where: { id: { in: abiertas.map((t) => t.id) } }, data: { sprintId: destino?.id ?? null } });
        await this.activity.record(
          abiertas.map((t) => ({ taskId: t.id, actorId, action: 'sprint', field: 'sprint', before: cur.name, after: destino?.name ?? null })),
          tx,
        );
      }
      await tx.sprint.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
    });
    return this.get(id);
  }

  /** Burndown: tareas (y puntos) sin terminar al final de cada día, desde el inicio hasta hoy o el fin. */
  async burndown(id: number): Promise<BurndownDto> {
    const sp = await this.prisma.sprint.findUnique({ where: { id } });
    if (!sp) throw new NotFoundException('Sprint no encontrado.');
    const tasks = await this.prisma.task.findMany({ where: { sprintId: id }, select: { closedAt: true, estimate: true, createdAt: true } });
    const total = tasks.length;
    const totalPoints = tasks.reduce((n, t) => n + (t.estimate ?? 0), 0);
    const dia = (d: Date) => d.toISOString().slice(0, 10);
    const hoy = new Date(dia(new Date()));
    const inicio = sp.startDate ?? (tasks.length ? new Date(dia(tasks.reduce((m, t) => (t.createdAt < m ? t.createdAt : m), tasks[0].createdAt))) : hoy);
    const fin = sp.endDate ?? hoy;
    const hasta = sp.status === 'CLOSED' && sp.closedAt ? new Date(dia(sp.closedAt)) : hoy;
    const ultimo = hasta < fin ? hasta : fin;
    const dias = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / 86_400_000));
    const points: BurndownDto['points'] = [];
    for (let d = new Date(inicio), i = 0; d <= ultimo && i < 120; d.setUTCDate(d.getUTCDate() + 1), i++) {
      const finDia = new Date(d);
      finDia.setUTCDate(finDia.getUTCDate() + 1);
      const abiertas = tasks.filter((t) => !t.closedAt || t.closedAt >= finDia);
      points.push({
        date: dia(d),
        remaining: abiertas.length,
        remainingPoints: abiertas.reduce((n, t) => n + (t.estimate ?? 0), 0),
        ideal: Math.max(0, Math.round((total * (1 - i / dias)) * 10) / 10),
      });
    }
    return { total, totalPoints, points };
  }

  async remove(id: number): Promise<void> {
    const cur = await this.prisma.sprint.findUnique({ where: { id }, include: { _count: { select: { tasks: true } } } });
    if (!cur) throw new NotFoundException('Sprint no encontrado.');
    if (cur._count.tasks > 0) throw new BadRequestException('El sprint tiene tareas; muévelas o ciérralo en vez de borrarlo.');
    await this.prisma.sprint.delete({ where: { id } });
  }

  private async ensureProject(id: number): Promise<{ id: number; key: string }> {
    const p = await this.prisma.project.findFirst({ where: { id, archived: false }, select: { id: true, key: true } });
    if (!p) throw new BadRequestException('Proyecto no válido (no existe o está archivado).');
    return p;
  }

  private async toDtos(rows: SprintRow[]): Promise<SprintDto[]> {
    const ids = rows.map((r) => r.id);
    const [total, done] = ids.length
      ? await Promise.all([
          this.prisma.task.groupBy({ by: ['sprintId'], where: { sprintId: { in: ids } }, _count: { _all: true } }),
          this.prisma.task.groupBy({ by: ['sprintId'], where: { sprintId: { in: ids }, status: { category: 'DONE' } }, _count: { _all: true } }),
        ])
      : [[], []];
    const t = new Map(total.map((x) => [x.sprintId, x._count._all]));
    const d = new Map(done.map((x) => [x.sprintId, x._count._all]));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      goal: r.goal,
      projectId: r.projectId,
      projectKey: r.project?.key ?? null,
      projectName: r.project?.name ?? null,
      startDate: fecha(r.startDate),
      endDate: fecha(r.endDate),
      status: r.status,
      total: t.get(r.id) ?? 0,
      done: d.get(r.id) ?? 0,
      closedAt: r.closedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
