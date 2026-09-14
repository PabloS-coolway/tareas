/** Claves de proyecto (COOL) y de tarea (COOL-12). */

export const CLAVE_PROYECTO_RE = /^[A-Z][A-Z0-9]{1,7}$/;

export function normalizarClaveProyecto(raw: string): string {
  return raw.trim().toUpperCase();
}

export function esClaveProyectoValida(key: string): boolean {
  return CLAVE_PROYECTO_RE.test(key);
}

export function claveTarea(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

/** COOL-12 → { projectKey: 'COOL', number: 12 } o null si no tiene esa forma. */
export function parsearClaveTarea(raw: string): { projectKey: string; number: number } | null {
  const m = /^([A-Za-z][A-Za-z0-9]{1,7})-(\d{1,9})$/.exec(raw.trim());
  if (!m) return null;
  return { projectKey: m[1].toUpperCase(), number: Number(m[2]) };
}

/**
 * Propone una clave a partir de un nombre ("Atención al Cliente" → ATC, "Coolway" → COOL, "sass-ia" → SASS).
 * Si hay varias palabras, iniciales; si no, las 4 primeras letras. Sólo letras/números.
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
