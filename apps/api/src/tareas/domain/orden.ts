/**
 * Posición de una tarea dentro de una columna del tablero.
 *
 * Cada tarea guarda un `order` real. Para insertar en la posición `index` de una columna se toma el punto
 * medio entre las vecinas: así mover una tarjeta escribe UNA fila, no toda la columna. Cuando el hueco
 * entre vecinas se agota (tras muchos movimientos en el mismo sitio), se renumera la columna entera.
 */

export const HUECO_MINIMO = 1e-6;

export interface Vecinas {
  prev?: number;
  next?: number;
}

/** Devuelve el `order` para la posición `index` dada la lista de `orders` vecinos (sin la tarea que se mueve). */
export function ordenPara(orders: number[], index: number): { order: number; renumerar: boolean } {
  const i = Math.max(0, Math.min(index, orders.length));
  const prev = i > 0 ? orders[i - 1] : undefined;
  const next = i < orders.length ? orders[i] : undefined;
  if (prev === undefined && next === undefined) return { order: 0, renumerar: false };
  if (prev === undefined) return { order: (next as number) - 1, renumerar: false };
  if (next === undefined) return { order: prev + 1, renumerar: false };
  return { order: (prev + next) / 2, renumerar: next - prev < HUECO_MINIMO };
}

/** Renumeración limpia: 0, 1, 2… en el orden dado. */
export function renumerar(ids: number[]): { id: number; order: number }[] {
  return ids.map((id, order) => ({ id, order }));
}
