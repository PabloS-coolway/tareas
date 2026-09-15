import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { NotificationsPageDto } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';

/** Avisos en la app. Nunca se avisa a quien hace la acción. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(userIds: (number | null | undefined)[], type: NotificationType, text: string, opts: { taskId?: number | null; actorId?: number | null }, tx?: Prisma.TransactionClient): Promise<void> {
    const destinatarios = [...new Set(userIds.filter((u): u is number => typeof u === 'number' && u !== opts.actorId))];
    if (!destinatarios.length) return;
    await (tx ?? this.prisma).notification.createMany({ data: destinatarios.map((userId) => ({ userId, type, text, taskId: opts.taskId ?? null, actorId: opts.actorId ?? null })) });
  }

  async listMine(userId: number, limit = 50): Promise<NotificationsPageDto> {
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 200),
        include: { task: { select: { number: true, title: true, project: { select: { key: true } } } } },
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is number => x !== null))];
    const actores = new Map((await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]));
    return {
      unread,
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        text: r.text,
        actor: r.actorId ? (actores.get(r.actorId) ?? null) : null,
        taskId: r.taskId,
        taskKey: r.task ? `${r.task.project.key}-${r.task.number}` : null,
        taskTitle: r.task?.title ?? null,
        readAt: r.readAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async unreadCount(userId: number): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: number, id?: number): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
  }

  /** Personas mencionadas con @Nombre o @email en un texto (nombres sin acentos y sin distinguir mayúsculas). */
  async mencionados(texto: string): Promise<number[]> {
    if (!texto.includes('@')) return [];
    const users = await this.prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true } });
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const t = norm(texto);
    return users
      .filter((u) => {
        const nombre = norm(u.name.trim());
        const primero = nombre.split(/\s+/)[0];
        return t.includes(`@${nombre}`) || t.includes(`@${norm(u.email)}`) || (primero.length >= 3 && new RegExp(`@${primero}(?![a-z0-9])`).test(t) && users.filter((o) => norm(o.name).split(/\s+/)[0] === primero).length === 1);
      })
      .map((u) => u.id);
  }
}
