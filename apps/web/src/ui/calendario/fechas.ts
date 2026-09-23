/** Fechas del calendario y del cronograma. Todo en AAAA-MM-DD (UTC), igual que las fechas de las tareas. */

export const iso = (d: Date): string => d.toISOString().slice(0, 10);
const utc = (s: string): Date => new Date(`${s}T00:00:00.000Z`);
export const sumarDias = (s: string, n: number): string => {
  const d = utc(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
export const diasEntre = (a: string, b: string): number => Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);

/** Mes `AAAA-MM` → primer día del mes. */
export const inicioDeMes = (mes: string): string => `${mes}-01`;
export const mesDe = (s: string): string => s.slice(0, 7);
export function sumarMeses(mes: string, n: number): string {
  const d = utc(inicioDeMes(mes));
  d.setUTCMonth(d.getUTCMonth() + n);
  return iso(d).slice(0, 7);
}

/** Lunes de la semana de `s` (la semana empieza en lunes). */
export function lunesDe(s: string): string {
  const dow = (utc(s).getUTCDay() + 6) % 7; // 0 = lunes
  return sumarDias(s, -dow);
}

/** Rejilla del mes: semanas completas de lunes a domingo que cubren el mes (5 o 6 filas). */
export function rejillaMes(mes: string): string[][] {
  const primero = inicioDeMes(mes);
  const ultimo = sumarDias(inicioDeMes(sumarMeses(mes, 1)), -1);
  const semanas: string[][] = [];
  for (let l = lunesDe(primero); l <= ultimo; l = sumarDias(l, 7)) semanas.push([0, 1, 2, 3, 4, 5, 6].map((i) => sumarDias(l, i)));
  return semanas;
}

/**
 * Barra de una tarea en el cronograma (en días desde `desde`, recortada a la ventana de `dias`).
 * Sin fecha de inicio, la barra es de un día (el vencimiento). `null` si cae fuera de la ventana.
 */
export function barra(t: { startDate: string | null; dueDate: string | null }, desde: string, dias: number): { inicio: number; largo: number; cortadaIzq: boolean; cortadaDer: boolean } | null {
  if (!t.dueDate) return null;
  const ini = t.startDate && t.startDate <= t.dueDate ? t.startDate : t.dueDate;
  const a = diasEntre(desde, ini);
  const b = diasEntre(desde, t.dueDate);
  if (b < 0 || a >= dias) return null;
  const inicio = Math.max(a, 0);
  const fin = Math.min(b, dias - 1);
  return { inicio, largo: fin - inicio + 1, cortadaIzq: a < 0, cortadaDer: b > dias - 1 };
}
