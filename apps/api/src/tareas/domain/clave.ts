/** Claves de proyecto (COOL, INC) y de tarea (COOL-12). Cortas, tipo Jira; se admiten hasta 24 caracteres con guiones. */

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

/** COOL-12 (o SASS-IA-12) → { projectKey, number } o null si no tiene esa forma. El número es el último tramo. */
export function parsearClaveTarea(raw: string): { projectKey: string; number: number } | null {
  const m = /^([A-Za-z][A-Za-z0-9-]{0,23})-(\d{1,9})$/.exec(raw.trim());
  if (!m) return null;
  const projectKey = m[1].toUpperCase();
  if (!CLAVE_PROYECTO_RE.test(projectKey)) return null;
  return { projectKey, number: Number(m[2]) };
}

/**
 * Propone una clave CORTA a partir de un nombre ("Atención al Cliente" → AC, "Coolway" → COOL, "sass-ia" → SI).
 * Si hay varias palabras, iniciales; si no, las 4 primeras letras. Si está ocupada, añade un número.
 */
export function proponerClave(nombre: string, ocupadas: Set<string> = new Set()): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim();
  const palabras = limpio.split(/\s+/).filter((p) => p.length > 1 && !['de', 'del', 'al', 'la', 'el', 'y'].includes(p.toLowerCase()));
  let base = palabras.length >= 2 ? palabras.map((p) => p[0]).join('') : limpio.replace(/\s+/g, '').slice(0, 4);
  base = base.toUpperCase().slice(0, 8);
  if (!/^[A-Z]/.test(base)) base = `P${base}`;
  if (base.length < 2) base = `${base}X`;
  let candidata = base;
  let n = 2;
  while (ocupadas.has(candidata)) candidata = `${base.slice(0, 7)}${n++}`;
  return candidata;
}
