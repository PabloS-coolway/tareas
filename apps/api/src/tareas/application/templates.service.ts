import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskTemplateDto, InstantiateTemplateDto, PRIORITIES, TASK_TYPES, TaskDto, TaskTemplateDto } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { TasksService } from './tasks.service';

/** Plantillas de tarea (campos + subtareas). */
@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  async list(projectId?: number): Promise<TaskTemplateDto[]> {
    const rows = await this.prisma.taskTemplate.findMany({
      where: projectId ? { OR: [{ projectId }, { projectId: null }] } : {},
      orderBy: [{ projectId: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toDto);
  }

  async create(dto: CreateTaskTemplateDto): Promise<TaskTemplateDto> {
    const name = dto.name?.trim();
    const title = dto.title?.trim();
    if (!name || !title) throw new BadRequestException('La plantilla necesita nombre y título de tarea.');
    if (dto.type && !TASK_TYPES.includes(dto.type)) throw new BadRequestException('Tipo no válido.');
    if (dto.priority && !PRIORITIES.includes(dto.priority)) throw new BadRequestException('Prioridad no válida.');
    const row = await this.prisma.taskTemplate.create({
      data: {
        projectId: dto.projectId ?? null,
        name,
        title,
        description: dto.description ?? '',
        type: dto.type ?? 'TASK',
        priority: dto.priority ?? 'NORMAL',
        tags: (dto.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
        estimate: dto.estimate ?? null,
        subtasks: (dto.subtasks ?? []).map((t) => t.trim()).filter(Boolean),
      },
    });
    return toDto(row);
  }

  /** Plantilla a partir de una tarea existente (con los títulos de sus subtareas). */
  async fromTask(taskId: number, name: string, global: boolean): Promise<TaskTemplateDto> {
    const t = await this.prisma.task.findUnique({ where: { id: taskId }, include: { subtasks: { select: { title: true }, orderBy: { number: 'asc' } } } });
    if (!t) throw new NotFoundException('Tarea no encontrada.');
    return this.create({
      projectId: global ? null : t.projectId,
      name,
      title: t.title,
      description: t.description,
      type: t.type,
      priority: t.priority,
      tags: t.tags,
      estimate: t.estimate,
      subtasks: t.subtasks.map((s) => s.title),
    });
  }

  async remove(id: number): Promise<void> {
    if (!(await this.prisma.taskTemplate.findUnique({ where: { id } }))) throw new NotFoundException('Plantilla no encontrada.');
    await this.prisma.taskTemplate.delete({ where: { id } });
  }

  /** Crea la tarea y sus subtareas. */
  async instantiate(id: number, dto: InstantiateTemplateDto, actorId: number): Promise<TaskDto> {
    const tpl = await this.prisma.taskTemplate.findUnique({ where: { id } });
    if (!tpl) throw new NotFoundException('Plantilla no encontrada.');
    if (!dto?.projectId) throw new BadRequestException('Indica el proyecto.');
    const t = await this.tasks.create(
      {
        projectId: dto.projectId,
        title: dto.title?.trim() || tpl.title,
        description: tpl.description,
        type: tpl.type,
        priority: tpl.priority,
        tags: tpl.tags,
        estimate: tpl.estimate,
        assigneeId: dto.assigneeId ?? null,
        sprintId: dto.sprintId ?? null,
        dueDate: dto.dueDate ?? null,
        parentId: dto.parentId ?? null,
      },
      actorId,
    );
    for (const title of tpl.subtasks) await this.tasks.create({ projectId: dto.projectId, title, parentId: t.id, sprintId: dto.sprintId ?? null }, actorId);
    return this.tasks.get(t.id);
  }
}

function toDto(r: { id: number; projectId: number | null; name: string; title: string; description: string; type: TaskTemplateDto['type']; priority: TaskTemplateDto['priority']; tags: string[]; estimate: number | null; subtasks: string[]; createdAt: Date }): TaskTemplateDto {
  return { id: r.id, projectId: r.projectId, name: r.name, title: r.title, description: r.description, type: r.type, priority: r.priority, tags: r.tags, estimate: r.estimate, subtasks: r.subtasks, createdAt: r.createdAt.toISOString() };
}
