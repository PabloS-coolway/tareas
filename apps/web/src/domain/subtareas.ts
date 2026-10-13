/** Lo mínimo de una tarea que hace falta para saber si está bloqueada. */
export interface TareaBloqueable {
  status: { key: string; category: string };
  blockedByOpenCount: number;
}

/**
 * Bloqueada = en un estado de bloqueo («bloqueada»/«blocked») o esperando a otra tarea sin terminar.
 * Mismo criterio que el panel del equipo. Una hecha nunca cuenta como bloqueada.
 */
export function estaBloqueada(t: TareaBloqueable): boolean {
  if (t.status.category === 'DONE') return false;
  const k = t.status.key.toLowerCase();
  return k.includes('bloq') || k.includes('block') || t.blockedByOpenCount > 0;
}

export interface ResumenSubtareas {
  total: number;
  hechas: number;
  bloqueadas: number;
}

export function resumirSubtareas(items: TareaBloqueable[]): ResumenSubtareas {
  return {
    total: items.length,
    hechas: items.filter((s) => s.status.category === 'DONE').length,
    bloqueadas: items.filter(estaBloqueada).length,
  };
}

/**
 * Si alguien las ordenó a mano, ese orden manda (la API ya las trae así). Si no: bloqueadas arriba (lo que hay
 * que desatascar), luego el resto abierto y las hechas al final; estable dentro de cada grupo.
 */
export function ordenarSubtareas<T extends TareaBloqueable & { subOrder?: number | null }>(items: T[]): T[] {
  if (items.some((t) => t.subOrder != null)) return items;
  const peso = (t: T) => (estaBloqueada(t) ? 0 : t.status.category === 'DONE' ? 2 : 1);
  return items.map((t, i) => ({ t, i })).sort((a, b) => peso(a.t) - peso(b.t) || a.i - b.i).map((x) => x.t);
}

/** La lista con el elemento de la posición `desde` llevado a `hasta` (lo que deja un arrastre). */
export function moverEnLista<T>(items: T[], desde: number, hasta: number): T[] {
  const copia = [...items];
  const [movido] = copia.splice(desde, 1);
  if (movido === undefined) return items;
  copia.splice(Math.max(0, Math.min(hasta, copia.length)), 0, movido);
  return copia;
}
