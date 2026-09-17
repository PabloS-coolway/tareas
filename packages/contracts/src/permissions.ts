/**
 * Catálogo de FEATURES (permisos por sección/acción).
 *
 * ⚠️ Es una lista **CERRADA y definida en código**: una feature es algo que la app sabe proteger de
 * verdad. Se puede asignar/quitar a un rol desde el panel, pero **no se inventan features nuevas desde la
 * web** — sería un permiso que no protege nada. Lo self-administrable es la asignación rol↔feature.
 */
export const FEATURES = [
  'tareas.ver',
  'tareas.editar',
  'tareas.borrar',
  'tareas.ver-todo',
  'proyectos.gestionar',
  'equipos.gestionar',
  'usuarios.gestionar',
  'usuarios.password',
  'roles.gestionar',
] as const;

export type Feature = (typeof FEATURES)[number];

/** Cómo se lee cada feature en la pantalla de roles. */
export const FEATURE_LABELS: Record<Feature, string> = {
  'tareas.ver': 'Ver proyectos y tareas',
  'tareas.editar': 'Crear y editar tareas, comentar y adjuntar',
  'tareas.borrar': 'Borrar tareas',
  'tareas.ver-todo': 'Ver los proyectos de todos los equipos (no sólo los suyos)',
  'proyectos.gestionar': 'Crear proyectos, estados e importar',
  'equipos.gestionar': 'Gestionar equipos: quién pertenece a cada uno y qué proyectos tiene',
  'usuarios.gestionar': 'Gestionar usuarios',
  'usuarios.password': 'Cambiar la contraseña de usuarios',
  'roles.gestionar': 'Gestionar roles y permisos',
};

/** La feature sin la que nadie podría volver a administrar: no puede quedarse sin ningún rol que la tenga. */
export const FEATURE_GESTION_ROLES: Feature = 'roles.gestionar';

export function isFeature(x: string): x is Feature {
  return (FEATURES as readonly string[]).includes(x);
}

/** Un rol tal como lo ve la pantalla de administración. */
export interface RoleDto {
  id: number;
  /** Identidad del rol (no se cambia): `miembro`, `admin`… */
  key: string;
  name: string;
  features: Feature[];
  active: boolean;
  /** Roles de sistema (miembro/admin): no se borran ni se les cambia la clave. */
  system: boolean;
}

/** Alta de rol. `features` va acotada al catálogo cerrado. */
export interface CreateRoleDto {
  key: string;
  name: string;
  features: Feature[];
}

/** Edición (parcial). El `key` NO se cambia: es la identidad del rol. */
export interface UpdateRoleDto {
  name?: string;
  features?: Feature[];
  active?: boolean;
}
