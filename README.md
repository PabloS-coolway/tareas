# Tareas · Grupo Yorga

Gestor de tareas propio del equipo (sustituye a ClickUp). Un punto intermedio entre Jira y ClickUp, básico
y funcional: proyectos con clave (`COOL-12`), tablero kanban con estados configurables, lista, tareas con
tipo/prioridad/asignado/fecha/etiquetas/puntos, épicas y subtareas (árbol), descripción con editor de texto enriquecido (guardado en Markdown) y comentarios en Markdown, adjuntos, historial de cambios, feed de actividad, búsqueda global sin acentos (Ctrl+K), límites WIP por columna, avisos en la app (menciones con @, asignaciones, comentarios, cambios de estado), dependencias entre tareas (bloqueada por), carriles en el tablero por persona o épica, vistas guardadas, burndown por sprint, tareas recurrentes, plantillas con subtareas, exportar a CSV,
**sprints de trabajo** transversales a los proyectos (mismo tablero para todos), **API con tokens personales** y **servidor MCP** para que Claude trabaje con las tareas. Importa todo lo
que había en ClickUp.

## Puesta en marcha

```bash
cp apps/api/.env.example apps/api/.env
npm run setup        # install + Postgres (Docker, puerto 5545) + cliente Prisma + migraciones
npm run dev          # API :3000 + web :5173
```

El primer admin se crea con `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` en `apps/api/.env` (idempotente:
puedes dejarlas). Roles de sistema: `admin` (todo) y `miembro` (ver y editar tareas).

## Migrar desde ClickUp

1. Token personal de ClickUp: *Settings → Apps → API Token*.
2. `CLICKUP_TOKEN=pk_… npm run clickup:export` → `docs/import/clickup-export.json` (no se versiona).
   Es incremental y respeta el límite de 100 peticiones/min del plan gratuito.
3. En la app: *Proyectos → Importar de ClickUp*, sube el JSON. Cada lista pasa a ser un proyecto (puedes
   fijar la clave de cada uno); se importan tareas, subtareas, comentarios y adjuntos. Por defecto todos los
   proyectos nacen con el mismo tablero (Pendiente · En curso · Bloqueada · Completado) y los estados de ClickUp
   se traducen por categoría; desactiva el interruptor para copiar los estados de cada lista tal cual. Los miembros
   que no existan se crean con contraseña temporal (se muestra al terminar). Repetirlo no duplica.

## Claude / MCP

Cada persona crea su token en *Tokens de API* y configura el MCP (`packages/mcp`) con `TAREAS_URL` y
`TAREAS_TOKEN`. Herramientas: `listar_proyectos`, `listar_tareas`, `mis_tareas`, `ver_tarea`, `crear_tarea`,
`editar_tarea`, `comentar`, `equipo`. Actúa con los permisos del dueño del token.

## Arquitectura

Monorepo (npm workspaces + Turborepo), mismas convenciones que `automatizaciones`:

```
apps/api/        NestJS hexagonal · auth (JWT + tokens de API, roles por feature) · tareas · importar
apps/web/        React + Vite + react-bootstrap · tablero (@hello-pangea/dnd), lista (DataTable), detalle
packages/contracts/  @yorga/contracts — DTOs compartidos API↔web↔MCP
packages/mcp/    @yorga/tareas-mcp — servidor MCP (stdio) sobre la API
scripts/         clickup-export.mjs
```

Adjuntos: en local, carpeta `uploads/`; en producción, DigitalOcean Spaces (`SPACES_*`). Sin `SPACES_*` en
producción la subida se deshabilita avisando (no se pierden ficheros en silencio).

## Antes de dar por terminado un cambio

```bash
npm run typecheck && npm test && npm run build
```

## Despliegue

DigitalOcean App Platform con `.do/app.yaml` (api + web + Postgres gestionado, deploy al hacer push a
`main`). Ver comentarios del fichero para los secretos.
