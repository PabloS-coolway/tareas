/**
 * Quién se entera de lo que pasa en una tarea: el responsable, quien la creó y las personas de seguimiento.
 * Sin repetidos ni huecos. (A quien hace la acción no se le avisa: eso lo filtra el servicio de avisos.)
 */
export function interesados(t: { assigneeId: number | null; reporterId?: number | null; followerIds: number[] }): number[] {
  const ids = [t.assigneeId, t.reporterId ?? null, ...t.followerIds].filter((u): u is number => typeof u === 'number');
  return [...new Set(ids)];
}

/** Lista de seguidores limpia: enteros positivos, sin repetidos, como mucho 20. */
export function limpiarSeguidores(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 20);
}
