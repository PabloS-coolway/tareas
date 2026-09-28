/** Plantilla del título de lo que entra por el formulario público, si el proyecto no pone otra. */
export const PLANTILLA_TITULO = 'Sucursal {sucursal} - {asunto}';
export const HUECOS_TITULO = ['sucursal', 'asunto', 'nombre', 'urgencia'] as const;
type Datos = Record<(typeof HUECOS_TITULO)[number], string>;

/** Limpia la plantilla que guarda el proyecto: vacía = la de por defecto; tiene que llevar {asunto}. */
export function limpiarPlantilla(plantilla: string | null | undefined): string {
  const p = (plantilla ?? '').trim().slice(0, 120);
  if (!p) return PLANTILLA_TITULO;
  if (!p.includes('{asunto}')) throw new Error('La plantilla del título tiene que llevar {asunto}.');
  return p;
}

/**
 * Título de una incidencia a partir de la plantilla del proyecto: «Sucursal {sucursal} - {asunto}» →
 * «Sucursal 12 - Se ha roto la TPV». Si la sucursal ya empieza por la palabra que la precede en la
 * plantilla («Sucursal 12 · Palermo»), no se repite. Los huecos desconocidos se dejan tal cual.
 */
export function tituloIncidencia(plantilla: string, datos: Datos): string {
  return plantilla
    .replace(/(\p{L}+)(\s*)\{sucursal\}/gu, (_, palabra: string, esp: string) =>
      datos.sucursal.trim().toLowerCase().startsWith(palabra.toLowerCase()) ? datos.sucursal.trim() : `${palabra}${esp}${datos.sucursal.trim()}`,
    )
    .replace(/\{(\w+)\}/g, (hueco, k: string) => (k in datos ? datos[k as keyof Datos].trim() : hueco))
    .slice(0, 200);
}
