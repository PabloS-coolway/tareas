import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProjectDto, ProjectDto, ProjectStatusDto, UpdateProjectDto, UpsertStatusDto } from '@yorga/contracts';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { esClaveProyectoValida, normalizarClaveProyecto } from '../domain/clave';

/** Estados con los que nace un proyecto (los mismos que usaba el equipo en ClickUp, más "bloqueada"). */
export const ESTADOS_POR_DEFECTO: Omit<UpsertStatusDto, 'id'>[] = [
  { key: 'pendiente', name: 'Pendiente', color: '#87909e', category: 'TODO' },
  { key: 'en-curso', name: 'En curso', color: '#5f55ee', category: 'DOING' },
  { key: 'bloqueada', name: 'Bloqueada', color: '#d97706', category: 'DOING' },
  { key: 'completado', name: 'Completado', color: '#008844', category: 'DONE' },
];

/** "En curso" de verdad: categoría DOING pero sin los estados de bloqueo (bloqueada/blocked). */
const EN_CURSO: Prisma.TaskWhereInput = { status: { category: 'DOING', NOT: { key: { contains: 'bloq' } } } };

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number, includeArchived = false): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: includeArchived ? {} : { archived: false },
      orderBy: { name: 'asc' },
      include: { statuses: { orderBy: { order: 'asc' } } },
    });
    // Conteos de abiertas y "mías" en una consulta cada uno (no una por proyecto).
    const abiertas = await this.prisma.task.groupBy({ by: ['projectId'], where: { status: { category: { not: 'DONE' } } }, _count: { _all: true } });
    const mias = await this.prisma.task.groupBy({ by: ['projectId'], where: { status: { category: { not: 'DONE' } }, assigneeId: userId }, _count: { _all: true } });
    const enCurso = await this.prisma.task.groupBy({ by: ['projectId'], where: { ...EN_CURSO, assigneeId: userId }, _count: { _all: true } });
    const hechas = await this.prisma.task.groupBy({ by: ['projectId'], where: { status: { category: 'DONE' } }, _count: { _all: true } });
    const hm = new Map(hechas.map((a) => [a.projectId, a._count._all]));
    const ab = new Map(abiertas.map((a) => [a.projectId, a._count._all]));
    const mi = new Map(mias.map((a) => [a.projectId, a._count._all]));
    const ec = new Map(enCurso.map((a) => [a.projectId, a._count._all]));
    return projects.map((p) => toDto(p, ab.get(p.id) ?? 0, mi.get(p.id) ?? 0, ec.get(p.id) ?? 0, hm.get(p.id) ?? 0));
  }

  async get(idOrKey: string, userId: number): Promise<ProjectDto> {
    const where = /^\d+$/.test(idOrKey) ? { id: Number(idOrKey) } : { key: normalizarClaveProyecto(idOrKey) };
    const p = await this.prisma.project.findUnique({ where, include: { statuses: { orderBy: { order: 'asc' } } } });
    if (!p) throw new NotFoundException('Proyecto no encontrado.');
    const open = await this.prisma.task.count({ where: { projectId: p.id, status: { category: { not: 'DONE' } } } });
    const mine = await this.prisma.task.count({ where: { projectId: p.id, assigneeId: userId, status: { category: { not: 'DONE' } } } });
    const doing = await this.prisma.task.count({ where: { projectId: p.id, assigneeId: userId, ...EN_CURSO } });
    const done = await this.prisma.task.count({ where: { projectId: p.id, status: { category: 'DONE' } } });
    return toDto(p, open, mine, doing, done);
  }

  async create(dto: CreateProjectDto, userId: number): Promise<ProjectDto> {
    const key = normalizarClaveProyecto(dto.key ?? '');
    if (!esClaveProyectoValida(key)) throw new BadRequestException('La clave debe tener 2-24 letras/números (guiones entre tramos) y empezar por letra, p. ej. COOL o INC.');
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Indica el nombre del proyecto.');
    if (await this.prisma.project.findUnique({ where: { key } })) throw new ConflictException(`Ya existe un proyecto con la clave ${key}.`);
    const p = await this.prisma.project.create({
      data: {
        key,
        name,
        description: dto.description?.trim() ?? '',
        color: dto.color ?? '#6d28d9',
        statuses: { create: ESTADOS_POR_DEFECTO.map((s, order) => ({ ...s, order })) },
      },
      include: { statuses: { orderBy: { order: 'asc' } } },
    });
    return this.get(String(p.id), userId);
  }

  async update(id: number, dto: UpdateProjectDto, userId: number): Promise<ProjectDto> {
    const data: { key?: string; name?: string; description?: string; color?: string; archived?: boolean } = {};
    if (dto.key !== undefined) {
      const key = normalizarClaveProyecto(dto.key);
      if (!esClaveProyectoValida(key)) throw new BadRequestException('La clave debe tener 2-24 letras/números (guiones entre tramos) y empezar por letra, p. ej. COOL o INC.');
      const otro = await this.prisma.project.findUnique({ where: { key } });
      if (otro && otro.id !== id) throw new ConflictException(`Ya existe un proyecto con la clave ${key}.`);
      data.key = key; // las tareas se renumeran solas: la clave COOLWAY-12 se compone al leer
    }
    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestException('El nombre no puede quedar vacío.');
      data.name = dto.name.trim();
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.archived !== undefined) data.archived = dto.archived;
    await this.ensure(id);
    await this.prisma.project.update({ where: { id }, data });
    return this.get(String(id), userId);
  }

  /**
   * Reemplaza la lista de estados: crea los nuevos, actualiza los existentes (por id) y borra los que no
   * vengan. Un estado con tareas no se puede borrar (antes hay que moverlas). Al menos un estado.
   */
  async replaceStatuses(projectId: number, statuses: UpsertStatusDto[], userId: number): Promise<ProjectDto> {
    await this.ensure(projectId);
    if (!statuses?.length) throw new BadRequestException('Un proyecto necesita al menos un estado.');
    const keys = new Set<string>();
    for (const s of statuses) {
      const key = s.key?.trim().toLowerCase();
      if (!key || !s.name?.trim()) throw new BadRequestException('Cada estado necesita clave y nombre.');
      if (keys.has(key)) throw new BadRequestException(`Estado repetido: ${key}.`);
      keys.add(key);
    }
    const actuales = await this.prisma.projectStatus.findMany({ where: { projectId } });
    const ids = new Set(statuses.filter((s) => s.id).map((s) => s.id as number));
    const aBorrar = actuales.filter((a) => !ids.has(a.id));
    for (const b of aBorrar) {
      const n = await this.prisma.task.count({ where: { statusId: b.id } });
      if (n > 0) throw new BadRequestException(`El estado "${b.name}" tiene ${n} tareas: muévelas antes de borrarlo.`);
    }
    await this.prisma.$transaction(async (tx) => {
      if (aBorrar.length) await tx.projectStatus.deleteMany({ where: { id: { in: aBorrar.map((b) => b.id) } } });
      for (const [order, s] of statuses.entries()) {
        const wip = s.wipLimit === undefined || s.wipLimit === null || Number(s.wipLimit) <= 0 ? null : Math.floor(Number(s.wipLimit));
        const data = { key: s.key.trim().toLowerCase(), name: s.name.trim(), color: s.color || '#6b7280', category: s.category, order, wipLimit: wip };
        if (s.id) await tx.projectStatus.update({ where: { id: s.id }, data });
        else await tx.projectStatus.create({ data: { ...data, projectId } });
      }
    });
    return this.get(String(projectId), userId);
  }

  private async ensure(id: number): Promise<void> {
    if (!(await this.prisma.project.findUnique({ where: { id } }))) throw new NotFoundException('Proyecto no encontrado.');
  }
}

export function statusToDto(s: { id: number; key: string; name: string; color: string; order: number; category: 'TODO' | 'DOING' | 'DONE'; wipLimit?: number | null }): ProjectStatusDto {
  return { id: s.id, key: s.key, name: s.name, color: s.color, order: s.order, category: s.category, wipLimit: s.wipLimit ?? null };
}

function toDto(
  p: { id: number; key: string; name: string; description: string; color: string; archived: boolean; createdAt: Date; statuses: Parameters<typeof statusToDto>[0][] },
  openCount: number,
  mineCount: number,
  mineDoingCount = 0,
  doneCount = 0,
): ProjectDto {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    color: p.color,
    archived: p.archived,
    statuses: p.statuses.map(statusToDto),
    openCount,
    mineCount,
    mineDoingCount,
    doneCount,
    createdAt: p.createdAt.toISOString(),
  };
}
