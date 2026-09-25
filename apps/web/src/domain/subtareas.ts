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

/** Bloqueadas arriba (lo que hay que desatascar), luego el resto abierto y las hechas al final; estable dentro de cada grupo. */
export function ordenarSubtareas<T extends TareaBloqueable>(items: T[]): T[] {
  const peso = (t: T) => (estaBloqueada(t) ? 0 : t.status.category === 'DONE' ? 2 : 1);
  return items.map((t, i) => ({ t, i })).sort((a, b) => peso(a.t) - peso(b.t) || a.i - b.i).map((x) => x.t);
}
