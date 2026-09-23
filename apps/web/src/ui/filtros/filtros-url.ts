/**
 * Filtros de un tablero/lista ⇄ parámetros de la URL.
 *
 * Los filtros viven en la URL (`?assignee=me&tag=…`) para que sobrevivan a entrar en una tarea y volver,
 * a recargar, y para poder pasar el enlace. Sólo se escriben los que difieren del valor por defecto.
 */
export type ValorFiltro = string | boolean;
export type Filtros = Record<string, ValorFiltro>;

/** Lee de la URL los filtros conocidos (las claves de `defaults`); lo que falte toma el valor por defecto. */
export function leerFiltros<T extends Filtros>(params: URLSearchParams, defaults: T): T {
  const out: Filtros = { ...defaults };
  for (const [k, def] of Object.entries(defaults)) {
    const v = params.get(k);
    if (v === null) continue;
    out[k] = typeof def === 'boolean' ? v === '1' || v === 'true' : v;
  }
  return out as T;
}

/**
 * Escribe los filtros sobre `base` (conserva los parámetros que no son filtros) y quita los que valen lo
 * mismo que por defecto, para que la URL sin filtros quede limpia.
 */
export function escribirFiltros<T extends Filtros>(filtros: T, defaults: T, base = new URLSearchParams()): URLSearchParams {
  const out = new URLSearchParams(base);
  for (const [k, def] of Object.entries(defaults)) {
    const v = filtros[k] ?? def;
    if (v === def || v === '') out.delete(k);
    else out.set(k, typeof v === 'boolean' ? '1' : v);
  }
  return out;
}

/** ¿Trae la URL algún filtro? (si no, se recuperan los últimos usados en esa página). */
export function hayFiltros(params: URLSearchParams, defaults: Filtros): boolean {
  return Object.keys(defaults).some((k) => params.has(k));
}

/** ¿Hay algún filtro distinto del valor por defecto? (para enseñar «Limpiar filtros»). */
export function filtrosActivos<T extends Filtros>(filtros: T, defaults: T): boolean {
  return Object.entries(defaults).some(([k, def]) => filtros[k] !== def);
}
