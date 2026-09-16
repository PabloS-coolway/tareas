import { UserRefDto } from './auth';

// ---------- Catálogos cerrados ----------

export const TASK_TYPES = ['EPIC', 'TASK', 'BUG', 'INCIDENT'] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  EPIC: 'Épica',
  TASK: 'Tarea',
  BUG: 'Bug',
  INCIDENT: 'Incidencia',
};

export const PRIORITIES = ['URGENT', 'HIGH', 'NORMAL', 'LOW'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = {
  URGENT: 'Urgente',
  HIGH: 'Alta',
  NORMAL: 'Normal',
  LOW: 'Baja',
};

/** A qué "familia" pertenece un estado: decide qué cuenta como abierto/cerrado en KPIs y tablero. */
export const STATUS_CATEGORIES = ['TODO', 'DOING', 'DONE'] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];
export const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = {
  TODO: 'Por hacer',
  DOING: 'En marcha',
  DONE: 'Terminado',
};

export const RECURRENCES = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type Recurrence = (typeof RECURRENCES)[number];
export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  NONE: 'No se repite',
  DAILY: 'Cada día',
  WEEKLY: 'Cada semana',
  MONTHLY: 'Cada mes',
};

// ---------- Sprints ----------

export const SPRINT_STATUSES = ['PLANNED', 'ACTIVE', 'CLOSED'] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];
export const SPRINT_STATUS_LABELS: Record<SprintStatus, string> = {
  PLANNED: 'Planificado',
  ACTIVE: 'En curso',
  CLOSED: 'Cerrado',
};

/** Sprint de trabajo, transversal a los proyectos. */
export interface SprintDto {
  id: number;
  name: string;
  goal: string;
  /** ISO date (YYYY-MM-DD) o null. */
  startDate: string | null;
  endDate: string | null;
  status: SprintStatus;
  /** Tareas del sprint (todas / terminadas). */
  total: number;
  done: number;
  closedAt: string | null;
  createdAt: string;
}

export interface CreateSprintDto {
  name: string;
  goal?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateSprintDto {
  name?: string;
  goal?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: SprintStatus;
}

/** Cerrar un sprint: qué hacer con las tareas que no se terminaron (a otro sprint, o `null` = al backlog). */
export interface CloseSprintDto {
  moveOpenTo?: number | null;
}

// ---------- Proyectos ----------

export interface ProjectStatusDto {
  id: number;
  key: string;
  name: string;
  color: string;
  order: number;
  category: StatusCategory;
  /** Límite WIP de la columna (null = sin límite). Sólo avisa. */
  wipLimit: number | null;
}

export interface ProjectDto {
  id: number;
  /** Prefijo de las claves de tarea: COOL → COOL-12. Corto, tipo Jira. */
  key: string;
  name: string;
  description: string;
  color: string;
  archived: boolean;
  statuses: ProjectStatusDto[];
  /** Tareas abiertas (no DONE). */
  openCount: number;
  /** Tareas abiertas asignadas a quien pregunta. */
  mineCount: number;
  /** De las mías, las que están EN CURSO (categoría DOING, sin contar las bloqueadas): el número del menú. */
  mineDoingCount: number;
  createdAt: string;
}

export interface CreateProjectDto {
  key: string;
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateProjectDto {
  /** Cambiarla renombra las claves de todas sus tareas (COOL-12 → CW-12). */
  key?: string;
  name?: string;
  description?: string;
  color?: string;
  archived?: boolean;
}

/** Estado a guardar. Sin `id` = nuevo. Los estados que no vengan en la lista se borran (si no tienen tareas). */
export interface UpsertStatusDto {
  id?: number;
  key: string;
  name: string;
  color: string;
  category: StatusCategory;
  wipLimit?: number | null;
}

// ---------- Tareas ----------

export interface TaskDto {
  id: number;
  /** COOL-12 */
  key: string;
  number: number;
  projectId: number;
  projectKey: string;
  title: string;
  description: string;
  type: TaskType;
  status: ProjectStatusDto;
  priority: Priority;
  assignee: UserRefDto | null;
  reporter: UserRefDto;
  parentId: number | null;
  parentKey: string | null;
  parentTitle: string | null;
  sprintId: number | null;
  sprintName: string | null;
  /** ISO date (YYYY-MM-DD) o null. */
  dueDate: string | null;
  startDate: string | null;
  tags: string[];
  /** Puntos de estimación; null = sin estimar. */
  estimate: number | null;
  recurrence: Recurrence;
  /** Cuántas tareas que la bloquean siguen sin terminar (0 = libre). */
  blockedByOpenCount: number;
  order: number;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  subtaskCount: number;
  doneSubtaskCount: number;
  commentCount: number;
  attachmentCount: number;
  /** Si vino de ClickUp, el enlace original. */
  clickupUrl: string | null;
}

export interface CreateTaskDto {
  projectId: number;
  title: string;
  description?: string;
  type?: TaskType;
  statusId?: number;
  priority?: Priority;
  assigneeId?: number | null;
  parentId?: number | null;
  sprintId?: number | null;
  dueDate?: string | null;
  startDate?: string | null;
  tags?: string[];
  estimate?: number | null;
  recurrence?: Recurrence;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  type?: TaskType;
  statusId?: number;
  priority?: Priority;
  assigneeId?: number | null;
  parentId?: number | null;
  sprintId?: number | null;
  dueDate?: string | null;
  startDate?: string | null;
  tags?: string[];
  estimate?: number | null;
  recurrence?: Recurrence;
}

/** Mover en el tablero: a una columna (estado) y a una posición dentro de ella. */
export interface MoveTaskDto {
  statusId: number;
  index: number;
}

export interface TaskFilter {
  projectId?: number;
  statusId?: number;
  /** `me` = quien pregunta. */
  assigneeId?: number | 'me' | 'none';
  priority?: Priority;
  type?: TaskType;
  /** Texto en título o clave (COOL-12). */
  q?: string;
  parentId?: number | null;
  /** Sprint; `none` = backlog (sin sprint). */
  sprintId?: number | 'none';
  /** Etiqueta exacta (en minúsculas). */
  tag?: string;
  /** Sólo vencidas (fecha límite pasada y no terminadas). */
  overdue?: boolean;
  /** Modo tablero: sin épicas y sin subtareas (se ven dentro de su padre). */
  board?: boolean;
  /** Incluir terminadas. En tablero, sólo las cerradas en los últimos `doneDays` días. */
  includeDone?: boolean;
  doneDays?: number;
  page?: number;
  pageSize?: number;
}

export interface TaskPageDto {
  items: TaskDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Dependencias ----------

/** Referencia corta a una tarea (para dependencias, avisos…). */
export interface TaskRefDto {
  id: number;
  key: string;
  title: string;
  done: boolean;
  status: ProjectStatusDto;
  assignee: UserRefDto | null;
}

export interface DependenciesDto {
  /** Tareas que tienen que terminar antes que ésta. */
  blockedBy: TaskRefDto[];
  /** Tareas que esperan a ésta. */
  blocks: TaskRefDto[];
}

// ---------- Avisos ----------

export const NOTIFICATION_TYPES = ['MENTION', 'ASSIGNED', 'COMMENT', 'STATUS', 'BLOCKER_DONE'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationDto {
  id: number;
  type: NotificationType;
  text: string;
  actor: UserRefDto | null;
  taskId: number | null;
  taskKey: string | null;
  taskTitle: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPageDto {
  items: NotificationDto[];
  unread: number;
}

// ---------- Vistas guardadas ----------

/** Filtros de un tablero/lista tal como los guarda la UI (claves libres: q, assignee, priority, tag…). */
export type ViewFilters = Record<string, string | boolean | number | null>;

export interface SavedViewDto {
  id: number;
  scope: 'project' | 'global';
  projectId: number | null;
  name: string;
  filters: ViewFilters;
  shared: boolean;
  /** Si es mía (puedo borrarla). */
  mine: boolean;
  createdAt: string;
}

export interface CreateSavedViewDto {
  scope: 'project' | 'global';
  projectId?: number | null;
  name: string;
  filters: ViewFilters;
  shared?: boolean;
}

// ---------- Plantillas ----------

export interface TaskTemplateDto {
  id: number;
  projectId: number | null;
  name: string;
  title: string;
  description: string;
  type: TaskType;
  priority: Priority;
  tags: string[];
  estimate: number | null;
  subtasks: string[];
  createdAt: string;
}

export interface CreateTaskTemplateDto {
  projectId?: number | null;
  name: string;
  title: string;
  description?: string;
  type?: TaskType;
  priority?: Priority;
  tags?: string[];
  estimate?: number | null;
  subtasks?: string[];
}

/** Crear una tarea (con sus subtareas) a partir de una plantilla. */
export interface InstantiateTemplateDto {
  projectId: number;
  title?: string;
  assigneeId?: number | null;
  sprintId?: number | null;
  dueDate?: string | null;
  parentId?: number | null;
}

// ---------- Burndown ----------

export interface BurndownPointDto {
  /** YYYY-MM-DD */
  date: string;
  /** Tareas del sprint sin terminar al final de ese día. */
  remaining: number;
  remainingPoints: number;
  /** Línea ideal (de total a 0). */
  ideal: number;
}

export interface BurndownDto {
  total: number;
  totalPoints: number;
  points: BurndownPointDto[];
}

/** Etiqueta con cuántas tareas la llevan (para los filtros y el autocompletado). */
export interface TagCountDto {
  tag: string;
  count: number;
}

// ---------- Comentarios, adjuntos, actividad ----------

export interface CommentDto {
  id: number;
  taskId: number;
  author: UserRefDto;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentDto {
  id: number;
  taskId: number;
  filename: string;
  mimeType: string;
  size: number;
  uploader: UserRefDto;
  createdAt: string;
  /** Ruta de descarga (relativa a /api). */
  url: string;
}

/** Qué cambió en una tarea. `action` es una clave estable; `field/before/after` describen el cambio. */
export interface ActivityDto {
  id: number;
  taskId: number;
  actor: UserRefDto | null;
  action: string;
  field: string | null;
  before: string | null;
  after: string | null;
  createdAt: string;
}

/** Entrada del feed global de actividad: el cambio más la tarea a la que pertenece. */
export interface ActivityFeedItemDto extends ActivityDto {
  taskKey: string;
  taskTitle: string;
  projectKey: string;
}

// ---------- KPIs de equipo (panel del CTO) ----------

export interface KpiPersonaDto {
  user: UserRefDto;
  open: number;
  doing: number;
  overdue: number;
  done7d: number;
}

export interface KpiProyectoDto {
  projectId: number;
  key: string;
  name: string;
  color: string;
  open: number;
  doing: number;
  overdue: number;
  done7d: number;
  created7d: number;
}

export interface KpiSemanaDto {
  /** Lunes de la semana (YYYY-MM-DD). */
  week: string;
  created: number;
  done: number;
}

export interface KpisDto {
  open: number;
  doing: number;
  blocked: number;
  unassigned: number;
  overdue: number;
  /** Abiertas sin tocar (sin actualizar) desde hace más de 30 días. */
  stale: number;
  urgentOpen: number;
  done7d: number;
  done7dPrev: number;
  created7d: number;
  done30d: number;
  created30d: number;
  /** Mediana de días entre creación y cierre, cerradas en 30 días. */
  leadTimeDays: number | null;
  /** Antigüedad media (días) de las abiertas. */
  avgAgeDays: number | null;
  activeSprint: { id: number; name: string; total: number; done: number; points: number; pointsDone: number; daysLeft: number | null } | null;
  porPersona: KpiPersonaDto[];
  porProyecto: KpiProyectoDto[];
  semanas: KpiSemanaDto[];
}

// ---------- Inicio ----------

export interface ResumenProyectoDto {
  projectId: number;
  key: string;
  name: string;
  color: string;
  open: number;
  mine: number;
}

export interface ResumenDto {
  misAbiertas: number;
  misEnCurso: number;
  misVencidas: number;
  /** Terminadas por mí esta semana (7 días) y en los 7 anteriores. */
  misHechas7d: number;
  misHechas7dPrev: number;
  /** Asignadas a mí en los últimos 7 días. */
  misNuevas7d: number;
  /** Sprint activo: mis tareas dentro. */
  miSprint: { id: number; name: string; total: number; done: number; daysLeft: number | null } | null;
  porProyecto: ResumenProyectoDto[];
  /** Mis tareas que vencen antes (máx. 8). */
  proximas: TaskDto[];
}

// ---------- Importación desde ClickUp ----------

/** Resultado del import: cuenta lo creado/actualizado y avisa de lo que no pudo mapear. */
export interface ClickUpImportResultDto {
  proyectos: number;
  tareas: number;
  comentarios: number;
  adjuntos: number;
  usuariosCreados: { email: string; name: string; passwordTemporal: string }[];
  avisos: string[];
}
