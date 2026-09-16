/**
 * Herramientas del MCP de Tareas Yorga. Se usan igual desde el servidor stdio (index.ts) y desde el
 * endpoint HTTP remoto de la API (/api/mcp): sólo cambia cómo se llama a la API (`api`).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/** Llama a la API de tareas en nombre del dueño del token. `path` empieza por / y va sin el prefijo /api. */
export type ApiFn = <T>(path: string, init?: RequestInit) => Promise<T>;

interface Status { id: number; key: string; name: string; category: string }
interface Project { id: number; key: string; name: string; statuses: Status[]; openCount: number; mineCount: number }
interface UserRef { id: number; name: string; email: string }
interface Sprint { id: number; name: string; goal: string; startDate: string | null; endDate: string | null; status: string; total: number; done: number }
interface Task {
  id: number; key: string; title: string; description: string; type: string; priority: string; status: Status;
  assignee: UserRef | null; parentKey: string | null; dueDate: string | null; tags: string[]; projectKey: string;
  subtaskCount: number; doneSubtaskCount: number; commentCount: number; updatedAt: string; sprintId: number | null; sprintName: string | null;
}


/** Aviso por cada llamada a una herramienta (para el registro de uso del servidor remoto). */
export type Hook = (e: { tool: string; args: unknown; ok: boolean; ms: number; error?: string }) => void;

/** Registra todas las herramientas en el servidor dado. */
export function registrarHerramientas(mcp: McpServer, api: ApiFn, hook?: Hook): void {
  // Envoltorio: mide, captura errores y avisa al hook; el resto del fichero usa `server.tool` como siempre.
  const server = {
    tool<S extends z.ZodRawShape>(name: string, description: string, schema: S, handler: (args: z.infer<z.ZodObject<S>>) => Promise<{ content: { type: 'text'; text: string }[] }>) {
      // La firma de McpServer.tool tiene muchas sobrecargas; el tipado útil está en ESTE wrapper, así que se relaja aquí.
      (mcp.tool as unknown as (...a: unknown[]) => void)(name, description, schema, async (args: z.infer<z.ZodObject<S>>) => {
        const t0 = Date.now();
        try {
          const r = await handler(args);
          hook?.({ tool: name, args, ok: true, ms: Date.now() - t0 });
          return r;
        } catch (e) {
          hook?.({ tool: name, args, ok: false, ms: Date.now() - t0, error: (e as Error).message });
          throw e;
        }
      });
    },
  };
  const proyecto = async (key: string): Promise<Project> => api<Project>(`/projects/${encodeURIComponent(key)}`);
  const porEmail = async (email: string): Promise<UserRef> => {
    const dir = await api<UserRef[]>('/users/directorio');
    const u = dir.find((x) => x.email.toLowerCase() === email.toLowerCase()) ?? dir.find((x) => x.name.toLowerCase().includes(email.toLowerCase()));
    if (!u) throw new Error(`No encuentro a "${email}" en el equipo.`);
    return u;
  };
  const estado = (p: Project, keyOrName: string): Status => {
    const s = p.statuses.find((x) => x.key === keyOrName.toLowerCase() || x.name.toLowerCase() === keyOrName.toLowerCase());
    if (!s) throw new Error(`Estado "${keyOrName}" no existe en ${p.key}. Estados: ${p.statuses.map((x) => x.key).join(', ')}.`);
    return s;
  };
  const sprintPorNombre = async (nombreOId: string): Promise<Sprint> => {
    const ss = await api<Sprint[]>('/sprints');
    const s = ss.find((x) => String(x.id) === nombreOId) ?? ss.find((x) => x.name.toLowerCase() === nombreOId.toLowerCase()) ?? ss.find((x) => x.name.toLowerCase().includes(nombreOId.toLowerCase()));
    if (!s) throw new Error(`No encuentro el sprint "${nombreOId}" (abiertos: ${ss.map((x) => x.name).join(', ') || 'ninguno'}).`);
    return s;
  };
  const resumenTarea = (t: Task) =>
    `${t.key} [${t.status.name}] (${t.priority}${t.type !== 'TASK' ? `, ${t.type}` : ''}) ${t.title}` +
    `${t.assignee ? ` → ${t.assignee.name}` : ''}${t.dueDate ? ` · vence ${t.dueDate}` : ''}${t.parentKey ? ` · padre ${t.parentKey}` : ''}` +
    `${t.subtaskCount ? ` · sub ${t.doneSubtaskCount}/${t.subtaskCount}` : ''}${t.sprintName ? ` · sprint ${t.sprintName}` : ''}`;
  const texto = (s: string) => ({ content: [{ type: 'text' as const, text: s }] });


  server.tool('listar_proyectos', 'Lista los proyectos con sus estados y cuántas tareas abiertas tienen.', {}, async () => {
    const ps = await api<Project[]>('/projects');
    return texto(ps.map((p) => `${p.key} · ${p.name} · ${p.openCount} abiertas (${p.mineCount} mías) · estados: ${p.statuses.map((s) => s.key).join(', ')}`).join('\n') || 'Sin proyectos.');
  });

  server.tool(
    'listar_tareas',
    'Busca tareas. Filtra por proyecto (clave), asignado ("me", "none" o email), estado, prioridad, tipo, sprint o texto.',
    {
      proyecto: z.string().optional().describe('Clave del proyecto, p. ej. COOL'),
      asignado: z.string().optional().describe('"me", "none" o el email/nombre de una persona'),
      estado: z.string().optional().describe('Clave o nombre del estado (requiere proyecto)'),
      prioridad: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).optional(),
      tipo: z.enum(['EPIC', 'TASK', 'BUG', 'INCIDENT']).optional(),
      texto: z.string().optional().describe('Texto en el título o clave (COOL-12)'),
      sprint: z.string().optional().describe('Nombre/id del sprint, o "none" para el backlog'),
      incluirTerminadas: z.boolean().optional(),
      limite: z.number().int().min(1).max(500).optional(),
    },
    async (a) => {
      const q = new URLSearchParams();
      if (a.sprint) q.set('sprintId', a.sprint === 'none' ? 'none' : String((await sprintPorNombre(a.sprint)).id));
      let p: Project | null = null;
      if (a.proyecto) {
        p = await proyecto(a.proyecto);
        q.set('projectId', String(p.id));
      }
      if (a.estado) {
        if (!p) throw new Error('Para filtrar por estado indica el proyecto.');
        q.set('statusId', String(estado(p, a.estado).id));
      }
      if (a.asignado) q.set('assigneeId', a.asignado === 'me' || a.asignado === 'none' ? a.asignado : String((await porEmail(a.asignado)).id));
      if (a.prioridad) q.set('priority', a.prioridad);
      if (a.tipo) q.set('type', a.tipo);
      if (a.texto) q.set('q', a.texto);
      if (a.incluirTerminadas) q.set('includeDone', 'true');
      q.set('pageSize', String(a.limite ?? 100));
      const page = await api<{ items: Task[]; total: number }>(`/tasks?${q}`);
      return texto(`${page.total} tareas\n` + page.items.map(resumenTarea).join('\n'));
    },
  );

  server.tool('mis_tareas', 'Mis tareas abiertas (las del dueño del token).', {}, async () => {
    const page = await api<{ items: Task[] }>('/tasks?assigneeId=me&pageSize=200');
    return texto(page.items.map(resumenTarea).join('\n') || 'No tienes tareas abiertas.');
  });

  server.tool('ver_tarea', 'Detalle completo de una tarea por clave (COOL-12): descripción, subtareas y comentarios.', { clave: z.string() }, async ({ clave }) => {
    const t = await api<Task>(`/tasks/${encodeURIComponent(clave)}`);
    const [subs, comments] = await Promise.all([api<Task[]>(`/tasks/${t.id}/subtasks`), api<{ author: UserRef; body: string; createdAt: string }[]>(`/tasks/${t.id}/comments`)]);
    const out = [
      resumenTarea(t),
      `proyecto: ${t.projectKey} · etiquetas: ${t.tags.join(', ') || '—'} · actualizada ${t.updatedAt}`,
      '',
      t.description || '(sin descripción)',
      '',
      subs.length ? `Subtareas:\n${subs.map(resumenTarea).join('\n')}` : 'Sin subtareas.',
      '',
      comments.length ? `Comentarios:\n${comments.map((c) => `- ${c.author.name} (${c.createdAt.slice(0, 16)}): ${c.body}`).join('\n')}` : 'Sin comentarios.',
    ];
    return texto(out.join('\n'));
  });

  server.tool(
    'crear_tarea',
    'Crea una tarea en un proyecto. Devuelve su clave.',
    {
      proyecto: z.string().describe('Clave del proyecto'),
      titulo: z.string(),
      descripcion: z.string().optional(),
      tipo: z.enum(['EPIC', 'TASK', 'BUG', 'INCIDENT']).optional(),
      prioridad: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).optional(),
      estado: z.string().optional().describe('Clave del estado inicial (por defecto el primero)'),
      asignado: z.string().optional().describe('Email o nombre de quien la hará'),
      vence: z.string().optional().describe('AAAA-MM-DD'),
      padre: z.string().optional().describe('Clave de la épica o tarea padre (COOL-3)'),
      etiquetas: z.array(z.string()).optional(),
      sprint: z.string().optional().describe('Nombre (o id) del sprint en el que planificarla'),
    },
    async (a) => {
      const p = await proyecto(a.proyecto);
      const body: Record<string, unknown> = { projectId: p.id, title: a.titulo, description: a.descripcion, type: a.tipo, priority: a.prioridad, dueDate: a.vence, tags: a.etiquetas };
      if (a.estado) body.statusId = estado(p, a.estado).id;
      if (a.asignado) body.assigneeId = (await porEmail(a.asignado)).id;
      if (a.padre) body.parentId = (await api<Task>(`/tasks/${encodeURIComponent(a.padre)}`)).id;
      if (a.sprint) body.sprintId = (await sprintPorNombre(a.sprint)).id;
      const t = await api<Task>('/tasks', { method: 'POST', body: JSON.stringify(body) });
      return texto(`Creada ${resumenTarea(t)}`);
    },
  );

  server.tool(
    'editar_tarea',
    'Cambia campos de una tarea: título, descripción, estado, prioridad, tipo, asignado, fecha, padre, etiquetas o sprint.',
    {
      clave: z.string(),
      titulo: z.string().optional(),
      descripcion: z.string().optional(),
      estado: z.string().optional().describe('Clave o nombre del estado'),
      prioridad: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).optional(),
      tipo: z.enum(['EPIC', 'TASK', 'BUG', 'INCIDENT']).optional(),
      asignado: z.string().optional().describe('Email/nombre, o "none" para desasignar'),
      vence: z.string().optional().describe('AAAA-MM-DD o "" para quitar'),
      padre: z.string().optional().describe('Clave del padre, o "" para quitar'),
      etiquetas: z.array(z.string()).optional(),
      sprint: z.string().optional().describe('Nombre (o id) del sprint, o "" para mandarla al backlog'),
    },
    async (a) => {
      const t = await api<Task>(`/tasks/${encodeURIComponent(a.clave)}`);
      const body: Record<string, unknown> = { title: a.titulo, description: a.descripcion, priority: a.prioridad, type: a.tipo, tags: a.etiquetas };
      if (a.vence !== undefined) body.dueDate = a.vence || null;
      if (a.estado) body.statusId = estado(await proyecto(t.projectKey), a.estado).id;
      if (a.asignado !== undefined) body.assigneeId = a.asignado === 'none' || a.asignado === '' ? null : (await porEmail(a.asignado)).id;
      if (a.padre !== undefined) body.parentId = a.padre ? (await api<Task>(`/tasks/${encodeURIComponent(a.padre)}`)).id : null;
      if (a.sprint !== undefined) body.sprintId = a.sprint ? (await sprintPorNombre(a.sprint)).id : null;
      const u = await api<Task>(`/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      return texto(`Actualizada ${resumenTarea(u)}`);
    },
  );

  server.tool('comentar', 'Añade un comentario a una tarea.', { clave: z.string(), texto: z.string() }, async (a) => {
    const t = await api<Task>(`/tasks/${encodeURIComponent(a.clave)}`);
    await api(`/tasks/${t.id}/comments`, { method: 'POST', body: JSON.stringify({ body: a.texto }) });
    return texto(`Comentario publicado en ${t.key}.`);
  });

  server.tool('listar_sprints', 'Sprints de trabajo (abiertos; con cerrados=true, todos) y su progreso.', { cerrados: z.boolean().optional() }, async ({ cerrados }) => {
    const ss = await api<Sprint[]>(`/sprints${cerrados ? '?closed=true' : ''}`);
    if (!ss.length) return texto('No hay sprints.');
    return texto(ss.map((s) => `#${s.id} ${s.name} [${s.status}] ${s.startDate ?? '…'} → ${s.endDate ?? '…'} · ${s.done}/${s.total} terminadas${s.goal ? ` · objetivo: ${s.goal}` : ''}`).join('\n'));
  });

  server.tool(
    'crear_sprint',
    'Crea un sprint de trabajo (transversal a los proyectos).',
    { nombre: z.string(), objetivo: z.string().optional(), empieza: z.string().optional().describe('AAAA-MM-DD'), termina: z.string().optional().describe('AAAA-MM-DD') },
    async (a) => {
      const s = await api<Sprint>('/sprints', { method: 'POST', body: JSON.stringify({ name: a.nombre, goal: a.objetivo, startDate: a.empieza, endDate: a.termina }) });
      return texto(`Creado el sprint #${s.id} ${s.name}.`);
    },
  );

  server.tool('equipo', 'Personas del equipo (para asignar tareas).', {}, async () => {
    const dir = await api<UserRef[]>('/users/directorio');
    return texto(dir.map((u) => `${u.name} <${u.email}>`).join('\n'));
  });



}

/** Servidor MCP completo (nombre/versión + herramientas). */
export function crearServidor(api: ApiFn, hook?: Hook): McpServer {
  const server = new McpServer({ name: 'tareas-yorga', version: '0.2.0' });
  registrarHerramientas(server, api, hook);
  return server;
}
