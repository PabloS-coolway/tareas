# CLAUDE.md · Contexto del proyecto

Gestor de tareas del **Grupo Yorga** (sustituye a ClickUp). Usuario: **Pablo Silva, CTO**. Lo usa todo el
equipo (Robert, Juanmi, Pablo Vázquez, Catalina, Gemma, David, Tomás) y Claude a través del MCP.

## Cómo trabajamos

1. Mismas convenciones que `automatizaciones`: **hexagonal** en la API (`domain / application /
   infrastructure / interface`), DTOs compartidos en `@yorga/contracts` (no duplicar tipos), comentarios y UI
   **en español**.
2. **Verificar de verdad, no asumir**: ejecutar (curl a la API, o el navegador) y enseñar el resultado real.
3. Ante un bug: síntoma + causa raíz + **test de regresión** que se pone en rojo si se reintroduce.
4. La lógica que puede romper el negocio vive en `domain/` con tests (orden del tablero, claves, permisos).

## Reglas que no se negocian

- Toda escritura queda en el **historial de la tarea** (`TaskActivity`): quién, qué campo, antes → después.
- Los tokens de API se guardan **hasheados**; el secreto sólo se enseña al crearlo.
- Los adjuntos se sirven **por la API** (con permiso), nunca por URL pública.
- Un estado con tareas **no se borra**; se mueven antes.
- Los permisos son **features** de un catálogo cerrado (`packages/contracts/src/permissions.ts`).

## Operativa técnica

- **Git**: remoto `origin` (alias SSH `github-coolway`) → `PabloS-coolway/tareas`. Identidad del repo:
  `Pablo Silva <pablo.silva@coolway.com>` (nunca el email de oxigent).
- **Puertos**: API `:3000`, web `:5173`, Postgres **`:5545`** (host; `automatizaciones` usa 5544).
- La API con `npm run dev` **no recarga en caliente**: tras tocar el backend hay que reiniciarla.
- Antes de dar algo por terminado: `npm run typecheck && npm test && npm run build`.

## Mapa

```
apps/api/src/auth        login JWT · tokens de API (tk_…) · usuarios · roles por feature · bootstrap admin/roles
apps/api/src/tareas      proyectos (estados configurables) · tareas (clave, tablero, épicas/subtareas) · comentarios · adjuntos · actividad
apps/api/src/importar    import idempotente desde el JSON de scripts/clickup-export.mjs
apps/web/src/ui/components  TableroGlobal (kanban multi-proyecto) · Paleta (búsqueda Ctrl+K) · SubtareasArbol · Markdown · ActividadTexto · NuevaTareaModal
apps/web/src/ui/pages    Inicio (KPIs + feed de actividad) · MisTareas · Equipo (/equipo/:userId, quién tiene qué por proyecto) · TodasTareas (/tareas, tablero+lista global) · Sprints (/sprints, /sprints/:id: tablero transversal, añadir del backlog, cerrar) · Proyectos · Tablero (/p/:key) · Tarea (/t/:key) · Tokens · Usuarios · Roles
packages/mcp             servidor MCP (stdio) sobre la API, con token personal
```
