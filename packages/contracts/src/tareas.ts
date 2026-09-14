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
}

export interface ProjectDto {
  id: number;
  /** Prefijo de las claves de tarea: COOLWAY → COOLWAY-12. Por convención, el nombre del proyecto en mayúsculas. */
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
  createdAt: string;
}

export interface CreateProjectDto {
  key: string;
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateProjectDto {
  /** Cambiarla renombra las claves de todas sus tareas (COOL-12 → COOLWAY-12). */
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
  misVencidas: number;
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
