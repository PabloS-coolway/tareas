import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityDto, ActivityFeedItemDto } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';

export interface ActivityInput {
  taskId: number;
  actorId: number | null;
  action: string;
  field?: string;
  before?: string | null;
  after?: string | null;
}

/** Historial de una tarea: cada cambio deja una fila (quién, qué campo, antes → después). */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: ActivityInput | ActivityInput[], tx?: Prisma.TransactionClient): Promise<unknown> {
    const rows = (Array.isArray(input) ? input : [input]).map((i) => ({
      taskId: i.taskId,
      actorId: i.actorId,
      action: i.action,
      field: i.field ?? null,
      before: i.before ?? null,
      after: i.after ?? null,
    }));
    if (rows.length === 0) return Promise.resolve();
    return (tx ?? this.prisma).taskActivity.createMany({ data: rows });
  }

  async list(taskId: number): Promise<ActivityDto[]> {
    const rows = await this.prisma.taskActivity.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true, email: true } } },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      actor: r.actor,
      action: r.action,
      field: r.field,
      before: r.before,
      after: r.after,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Feed global (lo último que ha pasado en cualquier tarea), con la tarea a la que pertenece. */
  async feed(limit = 40, filtro: { projectId?: number; actorId?: number; beforeId?: number } = {}): Promise<ActivityFeedItemDto[]> {
    const rows = await this.prisma.taskActivity.findMany({
      where: { action: { not: 'imported' }, ...(filtro.projectId ? { task: { projectId: filtro.projectId } } : {}), ...(filtro.actorId ? { actorId: filtro.actorId } : {}), ...(filtro.beforeId ? { id: { lt: filtro.beforeId } } : {}) }, // el import masivo no es 'actividad' del equipo
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true, email: true } }, task: { select: { number: true, title: true, project: { select: { key: true } } } } },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      actor: r.actor,
      action: r.action,
      field: r.field,
      before: r.before,
      after: r.after,
      createdAt: r.createdAt.toISOString(),
      taskKey: `${r.task.project.key}-${r.task.number}`,
      taskTitle: r.task.title,
      projectKey: r.task.project.key,
    }));
  }
}
