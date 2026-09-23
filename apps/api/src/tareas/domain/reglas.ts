import type { Priority, RuleActionsDto, RuleConditionsDto, RuleTrigger, TaskType, UpdateTaskDto } from '@yorga/contracts';

/** Lo que ha pasado en una tarea y cómo está después del cambio. */
export interface EventoTarea {
  trigger: RuleTrigger;
  /** Clave del estado en el que queda la tarea. */
  statusKey: string;
  type: TaskType;
  priority: Priority;
  tags: string[];
  assigneeId: number | null;
  followerIds: number[];
}

export interface Regla {
  id: number;
  active: boolean;
  trigger: RuleTrigger;
  conditions: RuleConditionsDto;
  actions: RuleActionsDto;
}

/** ¿Salta esta regla con este evento? Todas las condiciones que tenga deben cumplirse. */
export function aplica(r: Regla, e: EventoTarea): boolean {
  if (!r.active || r.trigger !== e.trigger) return false;
  const c = r.conditions ?? {};
  if (c.statusKey && c.statusKey !== e.statusKey) return false;
  if (c.type && c.type !== e.type) return false;
  if (c.priority && c.priority !== e.priority) return false;
  if (c.tag && !e.tags.includes(c.tag.trim().toLowerCase())) return false;
  return true;
}

/**
 * Cambios que hace una regla sobre la tarea (sólo lo que cambia algo). Asignar sólo si está sin responsable,
 * salvo que la regla diga `reassign`. `null` = no hay nada que tocar (aparte de los avisos).
 */
export function cambiosDeRegla(a: RuleActionsDto, e: EventoTarea): UpdateTaskDto | null {
  const dto: UpdateTaskDto = {};
  if (a.assigneeId && a.assigneeId !== e.assigneeId && (a.reassign || e.assigneeId === null)) dto.assigneeId = a.assigneeId;
  const nuevos = (a.addFollowerIds ?? []).filter((u) => !e.followerIds.includes(u));
  if (nuevos.length) dto.followerIds = [...e.followerIds, ...nuevos];
  if (a.priority && a.priority !== e.priority) dto.priority = a.priority;
  const tags = (a.addTags ?? []).map((t) => t.trim().toLowerCase()).filter((t) => t && !e.tags.includes(t));
  if (tags.length) dto.tags = [...e.tags, ...tags];
  return Object.keys(dto).length ? dto : null;
}
