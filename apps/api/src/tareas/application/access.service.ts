import { Injectable, NotFoundException } from '@nestjs/common';
import { Feature } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';

/**
 * Quién ve qué. Regla: ves los proyectos de tus equipos y los que no tienen equipo; con la feature
 * `tareas.ver-todo` (admin) lo ves todo. Se consulta en cada petición (cambiar de equipo aplica al momento).
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async features(userId: number): Promise<Feature[]> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { roleRef: { select: { features: true, active: true } } } });
    return u?.roleRef.active ? (u.roleRef.features as Feature[]) : [];
  }

  async hasFeature(userId: number, f: Feature): Promise<boolean> {
    return (await this.features(userId)).includes(f);
  }

  async myTeamIds(userId: number): Promise<number[]> {
    const rows = await this.prisma.teamMember.findMany({ where: { userId }, select: { teamId: true } });
    return rows.map((r) => r.teamId);
  }

  /** Ids de proyectos visibles, o `null` si ve todos (sin restricción). */
  async visibleProjectIds(userId: number): Promise<number[] | null> {
    if (await this.hasFeature(userId, 'tareas.ver-todo')) return null;
    const teams = await this.myTeamIds(userId);
    const rows = await this.prisma.project.findMany({ where: { OR: [{ teamId: null }, { teamId: { in: teams } }] }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  /** Filtro Prisma para `projectId` respetando la visibilidad; `pedido` es el proyecto que pide el cliente, si lo hay. */
  async projectFilter(userId: number, pedido?: number): Promise<number | { in: number[] } | undefined> {
    const vis = await this.visibleProjectIds(userId);
    if (vis === null) return pedido;
    if (pedido !== undefined) return vis.includes(pedido) ? pedido : -1; // -1: no existe → lista vacía, sin revelar nada
    return { in: vis };
  }

  /** Si no lo ve, se comporta como si no existiera (`que` = lo que se pedía, para el mensaje). */
  async assertProjectVisible(userId: number, projectId: number, que = 'Proyecto'): Promise<void> {
    const vis = await this.visibleProjectIds(userId);
    if (vis !== null && !vis.includes(projectId)) throw new NotFoundException(`${que} no encontrad${que.endsWith('a') ? 'a' : 'o'}.`);
  }
}
