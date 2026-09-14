/**
 * Forma del fichero que produce `scripts/clickup-export.mjs` (un subconjunto de la API v2 de ClickUp).
 * Se tipa aquí lo que el import usa; el resto del JSON se ignora.
 */

export interface CuUser {
  id: number | string;
  username?: string | null;
  email?: string | null;
}

export interface CuStatus {
  status: string;
  type?: string; // open | custom | closed | done
  color?: string;
  orderindex?: number;
}

export interface CuAttachment {
  id: string;
  title?: string;
  url?: string;
  mimetype?: string;
  size?: number;
  date?: string | number;
}

export interface CuComment {
  id: string | number;
  comment_text?: string;
  user?: CuUser;
  date?: string | number;
}

export interface CuTask {
  id: string;
  name: string;
  description?: string | null;
  markdown_description?: string | null;
  status?: CuStatus;
  orderindex?: string | number;
  date_created?: string | number;
  date_updated?: string | number;
  date_closed?: string | number | null;
  due_date?: string | number | null;
  start_date?: string | number | null;
  creator?: CuUser;
  assignees?: CuUser[];
  tags?: { name: string }[];
  parent?: string | null;
  priority?: { priority?: string; id?: string | number } | null;
  url?: string;
  attachments?: CuAttachment[];
  comments?: CuComment[];
  /** Lo añade el script: id de la lista a la que pertenece. */
  list?: { id: string; name?: string };
}

export interface CuList {
  id: string;
  name: string;
  statuses?: CuStatus[];
  tasks: CuTask[];
}

export interface ClickUpExport {
  exportedAt?: string;
  team?: { id: string; name?: string };
  members?: CuUser[];
  lists: CuList[];
}

/** Opciones del import: claves por lista (si no, se proponen), si descargar adjuntos y si unificar estados. */
export interface ClickUpImportOptions {
  keys?: Record<string, string>;
  adjuntos?: boolean;
  /**
   * `true` (por defecto): todos los proyectos nacen con los estados estándar de la app (Pendiente / En curso /
   * Bloqueada / Completado) y cada estado de ClickUp se traduce por su categoría. `false`: se copian los
   * estados de cada lista de ClickUp tal cual.
   */
  estadosEstandar?: boolean;
}
