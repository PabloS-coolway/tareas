import type {
  ActivityDto,
  AttachmentDto,
  ClickUpImportResultDto,
  CommentDto,
  CreateProjectDto,
  CreateTaskDto,
  MoveTaskDto,
  ProjectDto,
  ResumenDto,
  TaskDto,
  TaskFilter,
  TaskPageDto,
  UpdateProjectDto,
  UpdateTaskDto,
  UpsertStatusDto,
  UserRefDto,
} from '@yorga/contracts';
import { apiFetch, errorMessage } from './api-client';

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function ok<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) throw new Error(await errorMessage(res, fallback));
  return res.status === 204 ? (undefined as T) : res.json();
}

function qs(f: TaskFilter): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === '') continue;
    p.set(k, v === null ? 'null' : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Adapter: proyectos, tareas, comentarios, adjuntos y actividad contra la API HTTP. */
export class HttpTareasGateway {
  // --- proyectos ---
  async proyectos(archived = false): Promise<ProjectDto[]> {
    return ok(await apiFetch(`/projects${archived ? '?archived=true' : ''}`), 'No se pudieron cargar los proyectos.');
  }
  async proyecto(idOrKey: string): Promise<ProjectDto> {
    return ok(await apiFetch(`/projects/${encodeURIComponent(idOrKey)}`), 'Proyecto no encontrado.');
  }
  async crearProyecto(dto: CreateProjectDto): Promise<ProjectDto> {
    return ok(await apiFetch('/projects', json('POST', dto)), 'No se pudo crear el proyecto.');
  }
  async editarProyecto(id: number, dto: UpdateProjectDto): Promise<ProjectDto> {
    return ok(await apiFetch(`/projects/${id}`, json('PATCH', dto)), 'No se pudo guardar el proyecto.');
  }
  async guardarEstados(id: number, statuses: UpsertStatusDto[]): Promise<ProjectDto> {
    return ok(await apiFetch(`/projects/${id}/statuses`, json('PUT', statuses)), 'No se pudieron guardar los estados.');
  }

  // --- tareas ---
  async tareas(filter: TaskFilter): Promise<TaskPageDto> {
    return ok(await apiFetch(`/tasks${qs(filter)}`), 'No se pudieron cargar las tareas.');
  }
  async tarea(idOrKey: string | number): Promise<TaskDto> {
    return ok(await apiFetch(`/tasks/${encodeURIComponent(String(idOrKey))}`), 'Tarea no encontrada.');
  }
  async subtareas(id: number): Promise<TaskDto[]> {
    return ok(await apiFetch(`/tasks/${id}/subtasks`), 'No se pudieron cargar las subtareas.');
  }
  async crearTarea(dto: CreateTaskDto): Promise<TaskDto> {
    return ok(await apiFetch('/tasks', json('POST', dto)), 'No se pudo crear la tarea.');
  }
  async editarTarea(id: number, dto: UpdateTaskDto): Promise<TaskDto> {
    return ok(await apiFetch(`/tasks/${id}`, json('PATCH', dto)), 'No se pudo guardar la tarea.');
  }
  async moverTarea(id: number, dto: MoveTaskDto): Promise<TaskDto> {
    return ok(await apiFetch(`/tasks/${id}/move`, json('POST', dto)), 'No se pudo mover la tarea.');
  }
  async borrarTarea(id: number): Promise<void> {
    return ok(await apiFetch(`/tasks/${id}`, { method: 'DELETE' }), 'No se pudo borrar la tarea.');
  }
  async resumen(): Promise<ResumenDto> {
    return ok(await apiFetch('/tasks/resumen'), 'No se pudo cargar el resumen.');
  }
  async directorio(): Promise<UserRefDto[]> {
    return ok(await apiFetch('/users/directorio'), 'No se pudo cargar el equipo.');
  }

  // --- comentarios ---
  async comentarios(taskId: number): Promise<CommentDto[]> {
    return ok(await apiFetch(`/tasks/${taskId}/comments`), 'No se pudieron cargar los comentarios.');
  }
  async comentar(taskId: number, body: string): Promise<CommentDto> {
    return ok(await apiFetch(`/tasks/${taskId}/comments`, json('POST', { body })), 'No se pudo publicar el comentario.');
  }
  async editarComentario(id: number, body: string): Promise<CommentDto> {
    return ok(await apiFetch(`/comments/${id}`, json('PATCH', { body })), 'No se pudo editar el comentario.');
  }
  async borrarComentario(id: number): Promise<void> {
    return ok(await apiFetch(`/comments/${id}`, { method: 'DELETE' }), 'No se pudo borrar el comentario.');
  }

  // --- adjuntos ---
  async adjuntos(taskId: number): Promise<AttachmentDto[]> {
    return ok(await apiFetch(`/tasks/${taskId}/attachments`), 'No se pudieron cargar los adjuntos.');
  }
  async subirAdjunto(taskId: number, file: File): Promise<AttachmentDto> {
    const fd = new FormData();
    fd.append('file', file);
    return ok(await apiFetch(`/tasks/${taskId}/attachments`, { method: 'POST', body: fd }), 'No se pudo subir el fichero.');
  }
  async borrarAdjunto(id: number): Promise<void> {
    return ok(await apiFetch(`/attachments/${id}`, { method: 'DELETE' }), 'No se pudo borrar el adjunto.');
  }
  /** La descarga lleva el token en la cabecera: se baja como blob y se dispara la descarga. */
  async descargarAdjunto(a: AttachmentDto): Promise<void> {
    const res = await apiFetch(a.url);
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo descargar el fichero.'));
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = a.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  // --- actividad ---
  async actividad(taskId: number): Promise<ActivityDto[]> {
    return ok(await apiFetch(`/tasks/${taskId}/activity`), 'No se pudo cargar la actividad.');
  }

  // --- import ---
  async importarClickUp(data: unknown, options: { keys?: Record<string, string>; adjuntos?: boolean; estadosEstandar?: boolean }): Promise<ClickUpImportResultDto> {
    return ok(await apiFetch('/import/clickup', json('POST', { data, options })), 'La importación falló.');
  }
}
