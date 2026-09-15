import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateSavedViewDto, SavedViewDto, ViewFilters } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';

/** Vistas guardadas: filtros con nombre, por persona (o compartidas con todos). */
@Injectable()
export class ViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number, scope: 'project' | 'global', projectId?: number | null): Promise<SavedViewDto[]> {
    const rows = await this.prisma.savedView.findMany({
      where: { scope, projectId: scope === 'project' ? (projectId ?? -1) : null, OR: [{ userId }, { shared: true }] },
      orderBy: [{ shared: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => toDto(r, userId));
  }

  async create(dto: CreateSavedViewDto, userId: number): Promise<SavedViewDto> {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Ponle nombre a la vista.');
    if (dto.scope !== 'project' && dto.scope !== 'global') throw new BadRequestException('Ámbito no válido.');
    if (dto.scope === 'project' && !dto.projectId) throw new BadRequestException('Una vista de proyecto necesita el proyecto.');
    const row = await this.prisma.savedView.create({
      data: { userId, scope: dto.scope, projectId: dto.scope === 'project' ? dto.projectId! : null, name, filters: (dto.filters ?? {}) as Prisma.InputJsonValue, shared: !!dto.shared },
    });
    return toDto(row, userId);
  }

  async remove(id: number, userId: number, puedeTodo: boolean): Promise<void> {
    const v = await this.prisma.savedView.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Vista no encontrada.');
    if (v.userId !== userId && !puedeTodo) throw new ForbiddenException('Sólo quien la creó puede borrarla.');
    await this.prisma.savedView.delete({ where: { id } });
  }
}

function toDto(r: { id: number; userId: number; scope: string; projectId: number | null; name: string; filters: Prisma.JsonValue; shared: boolean; createdAt: Date }, userId: number): SavedViewDto {
  return {
    id: r.id,
    scope: r.scope as 'project' | 'global',
    projectId: r.projectId,
    name: r.name,
    filters: (r.filters ?? {}) as ViewFilters,
    shared: r.shared,
    mine: r.userId === userId,
    createdAt: r.createdAt.toISOString(),
  };
}
