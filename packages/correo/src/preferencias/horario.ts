import { HorarioResumen } from './tipos';

const DIAS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Fecha (AAAA-MM-DD), hora (0-23) y día ISO de un instante en una zona horaria IANA (resuelve el horario de verano). */
export function enZona(instante: Date, zona: string): { fecha: string; hora: number; dia: number } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' })
      .formatToParts(instante)
      .map((p) => [p.type, p.value]),
  );
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: Number(partes.hour), dia: DIAS[partes.weekday] };
}

/**
 * ¿Toca mandar ya el resumen? Sí si hoy (en la zona del horario) es uno de sus días, ya es la hora o más tarde, y
 * no se mandó otro hoy. Si a la hora en punto el servidor estaba parado, sale en cuanto vuelve ese mismo día.
 */
export function tocaResumen(ahora: Date, ultimoResumen: Date | null, h: HorarioResumen): boolean {
  const hoy = enZona(ahora, h.zona);
  if (!h.dias.includes(hoy.dia) || hoy.hora < h.hora) return false;
  return !ultimoResumen || enZona(ultimoResumen, h.zona).fecha !== hoy.fecha;
}
