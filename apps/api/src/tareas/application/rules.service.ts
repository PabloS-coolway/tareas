import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PRIORITIES, RULE_TRIGGERS, TASK_TYPES, type RuleActionsDto, type RuleConditionsDto, type RuleDto, type RuleTrigger, type UpsertRuleDto } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { limpiarSeguidores } from '../domain/interesados';

const include = { project: { select: { key: true } }, createdBy: { select: { id: true, name: true, email: true } } } satisfies Prisma.AutomationRuleInclude;
type Row = Prisma.AutomationRuleGetPayload<{ include: typeof include }>;

/** Reglas automáticas por proyecto: alta, edición y borrado. La ejecución vive en TasksService. */
@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId?: number): Promise<RuleDto[]> {
    const rows = await this.prisma.automationRule.findMany({ where: projectId ? { projectId } : {}, include, orderBy: [{ projectId: 'asc' }, { id: 'asc' }] });
    return rows.map(toDto);
  }

  async create(dto: UpsertRuleDto, actorId: number): Promise<RuleDto> {
    const data = await this.validar(dto);
    const r = await this.prisma.automationRule.create({ data: { ...data, createdById: actorId }, include });
    return toDto(r);
  }

  async update(id: number, dto: UpsertRuleDto): Promise<RuleDto> {
    if (!(await this.prisma.automationRule.findUnique({ where: { id } }))) throw new NotFoundException('Regla no encontrada.');
    const data = await this.validar(dto);
    return toDto(await this.prisma.automationRule.update({ where: { id }, data, include }));
  }

  async remove(id: number): Promise<void> {
    await this.prisma.automationRule.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Regla no encontrada.');
    });
  }

  /** Sólo se guarda lo del catálogo; personas y estados tienen que existir. */
  private async validar(dto: UpsertRuleDto) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Ponle un nombre a la regla.');
    if (!RULE_TRIGGERS.includes(dto.trigger)) throw new BadRequestException('Momento no válido.');
    const project = await this.prisma.project.findUnique({ where: { id: Number(dto.projectId) }, include: { statuses: true } });
    if (!project) throw new BadRequestException('Proyecto no encontrado.');

    const c = dto.conditions ?? {};
    const conditions: RuleConditionsDto = {};
    if (c.statusKey) {
      if (dto.trigger !== 'STATUS') throw new BadRequestException('El estado sólo tiene sentido en «al pasar a un estado».');
      if (!project.statuses.some((s) => s.key === c.statusKey)) throw new BadRequestException(`El proyecto no tiene el estado «${c.statusKey}».`);
      conditions.statusKey = c.statusKey;
    }
    if (c.type) {
      if (!TASK_TYPES.includes(c.type)) throw new BadRequestException('Tipo no válido.');
      conditions.type = c.type;
    }
    if (c.priority) {
      if (!PRIORITIES.includes(c.priority)) throw new BadRequestException('Prioridad no válida.');
      conditions.priority = c.priority;
    }
    if (c.tag?.trim()) conditions.tag = c.tag.trim().toLowerCase();

    const a = dto.actions ?? {};
    const actions: RuleActionsDto = {};
    const personas = [...new Set([...(a.assigneeId ? [Number(a.assigneeId)] : []), ...limpiarSeguidores(a.addFollowerIds), ...limpiarSeguidores(a.notifyUserIds)])];
    if (personas.length) {
      const activos = await this.prisma.user.count({ where: { id: { in: personas }, active: true } });
      if (activos !== personas.length) throw new BadRequestException('Alguna persona de la regla no es válida.');
    }
    if (a.assigneeId) {
      actions.assigneeId = Number(a.assigneeId);
      if (a.reassign) actions.reassign = true;
    }
    if (a.addFollowerIds?.length) actions.addFollowerIds = limpiarSeguidores(a.addFollowerIds);
    if (a.priority) {
      if (!PRIORITIES.includes(a.priority)) throw new BadRequestException('Prioridad no válida.');
      actions.priority = a.priority;
    }
    const tags = (a.addTags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length) actions.addTags = [...new Set(tags)].slice(0, 10);
    if (a.notifyUserIds?.length) actions.notifyUserIds = limpiarSeguidores(a.notifyUserIds);
    if (!Object.keys(actions).length) throw new BadRequestException('La regla no hace nada: elige al menos una acción.');

    return { projectId: project.id, name, active: dto.active ?? true, trigger: dto.trigger, conditions: conditions as Prisma.InputJsonValue, actions: actions as Prisma.InputJsonValue };
  }
}

function toDto(r: Row): RuleDto {
  return {
    id: r.id,
    projectId: r.projectId,
    projectKey: r.project.key,
    name: r.name,
    active: r.active,
    trigger: r.trigger as RuleTrigger,
    conditions: (r.conditions ?? {}) as RuleConditionsDto,
    actions: (r.actions ?? {}) as RuleActionsDto,
    createdBy: r.createdBy,
    runs: r.runs,
    lastRunAt: r.lastRunAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}
