/** Esperas entre intentos (minutos). Tras el último, el correo queda como fallido. */
export const ESPERAS_MINUTOS = [1, 5, 15, 60];
export const MAX_INTENTOS = ESPERAS_MINUTOS.length + 1;

/** Cuándo reintentar tras `intentosHechos` intentos fallidos, o null si ya no se reintenta. */
export function siguienteIntento(intentosHechos: number, ahora: Date): Date | null {
  if (intentosHechos >= MAX_INTENTOS) return null;
  const espera = ESPERAS_MINUTOS[Math.max(0, intentosHechos - 1)] ?? ESPERAS_MINUTOS[ESPERAS_MINUTOS.length - 1];
  return new Date(ahora.getTime() + espera * 60_000);
}
