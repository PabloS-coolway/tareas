/**
 * Título de una incidencia que entra por el formulario público: «Sucursal 12 - Se ha roto la TPV».
 * La sucursal puede venir ya como «Sucursal 12 · Palermo» (de la lista) o sólo «12» (escrita a mano).
 */
export function tituloIncidencia(sucursal: string, asunto: string): string {
  const s = sucursal.trim();
  const conPrefijo = /^sucursal\b/i.test(s) ? s : `Sucursal ${s}`;
  return `${conPrefijo} - ${asunto.trim()}`;
}
