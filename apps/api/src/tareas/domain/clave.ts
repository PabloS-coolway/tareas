/** Claves de proyecto (COOLWAY, SASS-IA) y de tarea (COOLWAY-12). La clave es el nombre del proyecto en mayúsculas. */

/** Mayúsculas y números, con guiones entre tramos; 2-24 caracteres; empieza por letra. */
export const CLAVE_PROYECTO_RE = /^(?=.{2,24}$)[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/;

export function normalizarClaveProyecto(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^A-Z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function esClaveProyectoValida(key: string): boolean {
  return CLAVE_PROYECTO_RE.test(key);
}

export function claveTarea(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

/** COOLWAY-12 (o SASS-IA-12) → { projectKey, number } o null si no tiene esa forma. El número es el último tramo. */
export function parsearClaveTarea(raw: string): { projectKey: string; number: number } | null {
  const m = /^([A-Za-z][A-Za-z0-9-]{0,23})-(\d{1,9})$/.exec(raw.trim());
  if (!m) return null;
  const projectKey = m[1].toUpperCase();
  if (!CLAVE_PROYECTO_RE.test(projectKey)) return null;
  return { projectKey, number: Number(m[2]) };
}

/**
 * Propone la clave a partir del nombre: el nombre entero en mayúsculas sin acentos, con guiones
 * ("Atención al Cliente" → ATENCION-AL-CLIENTE, "sass-ia" → SASS-IA). Si está ocupada, añade un número.
 */
export function proponerClave(nombre: string, ocupadas: Set<string> = new Set()): string {
  let base = normalizarClaveProyecto(nombre).slice(0, 24).replace(/-$/, '');
  if (!/^[A-Z]/.test(base)) base = `P${base}`;
  if (base.length < 2) base = `${base}X`;
  let candidata = base;
  let n = 2;
  while (ocupadas.has(candidata)) candidata = `${base.slice(0, 22)}-${n++}`;
  return candidata;
}
