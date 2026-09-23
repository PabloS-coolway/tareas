import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CommentDto } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { interesados } from '../domain/interesados';
import { ActivityService } from './activity.service';
import { NotificationsService } from './notifications.service';

const author = { select: { id: true, name: true, email: true } } as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(taskId: number): Promise<CommentDto[]> {
    const rows = await this.prisma.taskComment.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' }, include: { author } });
    return rows.map(toDto);
  }

  async add(taskId: number, body: string, actorId: number): Promise<CommentDto> {
    const texto = body?.trim();
    if (!texto) throw new BadRequestException('El comentario está vacío.');
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { project: { select: { key: true } }, followers: { select: { userId: true } } } });
    if (!task) throw new NotFoundException('Tarea no encontrada.');
    const clave = `${task.project.key}-${task.number}`;
    const mencionados = await this.notifications.mencionados(texto);
    const row = await this.prisma.$transaction(async (tx) => {
      const c = await tx.taskComment.create({ data: { taskId, authorId: actorId, body: texto }, include: { author } });
      await this.activity.record({ taskId, actorId, action: 'comment', after: texto.slice(0, 120) }, tx);
      await this.notifications.notify(mencionados, 'MENTION', `te mencionó en ${clave}: “${texto.slice(0, 80)}”`, { taskId, actorId }, tx);
      const resto = interesados({ assigneeId: task.assigneeId, reporterId: task.reporterId, followerIds: task.followers.map((f) => f.userId) }).filter((u) => !mencionados.includes(u));
      await this.notifications.notify(resto, 'COMMENT', `comentó en ${clave}: “${texto.slice(0, 80)}”`, { taskId, actorId }, tx);
      return c;
    });
    return toDto(row);
  }

  async edit(id: number, body: string, actorId: number, puedeTodo: boolean): Promise<CommentDto> {
    const texto = body?.trim();
    if (!texto) throw new BadRequestException('El comentario está vacío.');
    const c = await this.prisma.taskComment.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Comentario no encontrado.');
    if (c.authorId !== actorId && !puedeTodo) throw new ForbiddenException('Sólo el autor puede editar su comentario.');
    return toDto(await this.prisma.taskComment.update({ where: { id }, data: { body: texto }, include: { author } }));
  }

  async remove(id: number, actorId: number, puedeTodo: boolean): Promise<void> {
    const c = await this.prisma.taskComment.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Comentario no encontrado.');
    if (c.authorId !== actorId && !puedeTodo) throw new ForbiddenException('Sólo el autor puede borrar su comentario.');
    await this.prisma.taskComment.delete({ where: { id } });
  }
}

function toDto(r: { id: number; taskId: number; body: string; createdAt: Date; updatedAt: Date; author: { id: number; name: string; email: string } }): CommentDto {
  return { id: r.id, taskId: r.taskId, author: r.author, body: r.body, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
}
