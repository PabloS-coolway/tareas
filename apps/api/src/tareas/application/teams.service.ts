import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTeamDto, TeamDto, UpdateTeamDto } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';

const CLAVE_RE = /^[A-Z][A-Z0-9]{1,11}$/;

/** Equipos: quién pertenece a cada uno y qué proyectos tiene. Lo administra quien tenga `equipos.gestionar`. */
@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number): Promise<TeamDto[]> {
    const rows = await this.prisma.team.findMany({ orderBy: { name: 'asc' }, include: { members: { select: { userId: true } }, _count: { select: { projects: true } } } });
    return rows.map((t) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      color: t.color,
      memberIds: t.members.map((m) => m.userId),
      projectCount: t._count.projects,
      mine: t.members.some((m) => m.userId === userId),
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async create(dto: CreateTeamDto, userId: number): Promise<TeamDto> {
    const key = (dto.key ?? '').trim().toUpperCase();
    if (!CLAVE_RE.test(key)) throw new BadRequestException('La clave debe tener 2-12 letras/números y empezar por letra (p. ej. MKT).');
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Indica el nombre del equipo.');
    if (await this.prisma.team.findUnique({ where: { key } })) throw new ConflictException(`Ya existe un equipo con la clave ${key}.`);
    const members = await this.validarMiembros(dto.memberIds ?? []);
    const t = await this.prisma.team.create({ data: { key, name, color: dto.color || '#4338ca', members: { create: members.map((m) => ({ userId: m })) } } });
    return (await this.list(userId)).find((x) => x.id === t.id) as TeamDto;
  }

  async update(id: number, dto: UpdateTeamDto, userId: number): Promise<TeamDto> {
    if (!(await this.prisma.team.findUnique({ where: { id } }))) throw new NotFoundException('Equipo no encontrado.');
    const data: { name?: string; color?: string } = {};
    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestException('El nombre no puede quedar vacío.');
      data.name = dto.name.trim();
    }
    if (dto.color !== undefined) data.color = dto.color;
    await this.prisma.$transaction(async (tx) => {
      await tx.team.update({ where: { id }, data });
      if (dto.memberIds !== undefined) {
        const members = await this.validarMiembros(dto.memberIds);
        await tx.teamMember.deleteMany({ where: { teamId: id, userId: { notIn: members } } });
        const actuales = new Set((await tx.teamMember.findMany({ where: { teamId: id }, select: { userId: true } })).map((m) => m.userId));
        const nuevos = members.filter((m) => !actuales.has(m));
        if (nuevos.length) await tx.teamMember.createMany({ data: nuevos.map((m) => ({ teamId: id, userId: m })) });
      }
    });
    return (await this.list(userId)).find((x) => x.id === id) as TeamDto;
  }

  /** Un equipo con proyectos no se borra: primero se reasignan. Los sprints de equipo pasan a globales. */
  async remove(id: number): Promise<void> {
    const t = await this.prisma.team.findUnique({ where: { id }, include: { _count: { select: { projects: true } } } });
    if (!t) throw new NotFoundException('Equipo no encontrado.');
    if (t._count.projects > 0) throw new BadRequestException(`El equipo tiene ${t._count.projects} proyectos: cámbialos de equipo antes de borrarlo.`);
    await this.prisma.team.delete({ where: { id } });
  }

  private async validarMiembros(ids: number[]): Promise<number[]> {
    const limpios = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    if (!limpios.length) return [];
    const existentes = await this.prisma.user.findMany({ where: { id: { in: limpios } }, select: { id: true } });
    if (existentes.length !== limpios.length) throw new BadRequestException('Algún miembro no existe.');
    return limpios;
  }
}
