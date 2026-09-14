import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityDto } from '@yorga/contracts';
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
}
