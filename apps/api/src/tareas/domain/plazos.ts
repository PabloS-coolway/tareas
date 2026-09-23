import type { Priority, SlaHoursDto, StatusCategory } from '@yorga/contracts';

/** Plazo por defecto (decisión de Pablo, 23-sep-2026): horas naturales hasta que alguien la empiece. */
export const PLAZO_POR_DEFECTO: SlaHoursDto = { URGENT: 2, HIGH: 8, NORMAL: 24, LOW: 72 };

/** Horas de plazo de una prioridad; null si el proyecto no tiene plazos o esa prioridad no lo tiene. */
export function horasDePlazo(sla: SlaHoursDto | null | undefined, prioridad: Priority): number | null {
  const h = sla?.[prioridad];
  return typeof h === 'number' && h > 0 ? h : null;
}

/** Hasta cuándo hay para empezarla. */
export function limiteDePlazo(creada: Date, horas: number): Date {
  return new Date(creada.getTime() + horas * 3_600_000);
}

/**
 * ¿Está fuera de plazo? Sólo mientras nadie la ha empezado (sigue en un estado «por hacer»):
 * en cuanto pasa a «en marcha» o se termina, el plazo de respuesta está cumplido.
 */
export function fueraDePlazo(t: { createdAt: Date; priority: Priority; category: StatusCategory }, sla: SlaHoursDto | null | undefined, ahora: Date): boolean {
  if (t.category !== 'TODO') return false;
  const h = horasDePlazo(sla, t.priority);
  return h !== null && limiteDePlazo(t.createdAt, h) <= ahora;
}

/** Plazos limpios: sólo prioridades conocidas y horas positivas (hasta 30 días). */
export function limpiarPlazos(x: unknown): SlaHoursDto | null {
  if (!x || typeof x !== 'object') return null;
  const out: SlaHoursDto = {};
  for (const p of ['URGENT', 'HIGH', 'NORMAL', 'LOW'] as const) {
    const v = Number((x as Record<string, unknown>)[p]);
    if (Number.isFinite(v) && v > 0) out[p] = Math.min(Math.round(v * 10) / 10, 720);
  }
  return Object.keys(out).length ? out : null;
}
