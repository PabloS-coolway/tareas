/** Avisos sin leer por proyecto, a partir de la clave de proyecto de la tarea de cada aviso (sin tarea = no cuenta). */
export function sinLeerPorProyecto(claves: (string | null | undefined)[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const k of claves) if (k) r[k] = (r[k] ?? 0) + 1;
  return r;
}

/** Ids de avisos que marcar leídos: enteros positivos, sin repetidos, como mucho 500. */
export function limpiarIdsAvisos(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
}
