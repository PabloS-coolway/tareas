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

// ---------- Tipos de formulario (textos) e imágenes ----------

/**
 * El mismo formulario sirve para cosas distintas: las SUCURSALES abren incidencias de tienda y los
 * usuarios de una APLICACIÓN (el SaaS) reportan fallos. Cambian los textos, no el funcionamiento:
 * «Urgente: no podemos vender» no le dice nada a quien usa un panel de informes.
 */
export const TIPOS_FORMULARIO = ['sucursal', 'aplicacion'] as const;
export type TipoFormulario = (typeof TIPOS_FORMULARIO)[number];

export interface TextosFormulario {
  /** Etiqueta del desplegable (se puede cambiar por proyecto). */
  etiqueta: string;
  /** Plantilla del título si el proyecto no pone otra. */
  titulo: string;
  ejemploAsunto: string;
  ejemploDetalle: string;
  urgencias: Record<'NORMAL' | 'HIGH' | 'URGENT', string>;
}

export const TEXTOS_FORMULARIO: Record<TipoFormulario, TextosFormulario> = {
  sucursal: {
    etiqueta: 'Sucursal',
    titulo: PLANTILLA_TITULO,
    ejemploAsunto: 'p. ej. No funciona el datáfono',
    ejemploDetalle: 'Desde cuándo, qué has probado, número de ticket…',
    urgencias: { NORMAL: 'Normal', HIGH: 'Alta: afecta a la venta', URGENT: 'Urgente: no podemos vender' },
  },
  aplicacion: {
    etiqueta: 'Instancia',
    titulo: '{sucursal} - {asunto}',
    ejemploAsunto: 'p. ej. No carga el informe de Meta',
    ejemploDetalle: 'En qué pantalla estabas, qué hacías y qué esperabas que pasara…',
    urgencias: { NORMAL: 'Normal', HIGH: 'Alta: me impide parte del trabajo', URGENT: 'Urgente: no puedo usar la aplicación' },
  },
};

export function tipoFormulario(v: unknown): TipoFormulario {
  return (TIPOS_FORMULARIO as readonly string[]).includes(v as string) ? (v as TipoFormulario) : 'sucursal';
}

/** La etiqueta del desplegable: la del proyecto si la puso, si no la del tipo. */
export function etiquetaFormulario(tipo: TipoFormulario, propia: string | null | undefined): string {
  return (propia ?? '').trim().slice(0, 40) || TEXTOS_FORMULARIO[tipo].etiqueta;
}

/** Imágenes en el formulario público: capturas de pantalla o fotos, nada más. */
export const MAX_IMAGENES = 5;
export const MAX_IMAGEN_BYTES = 10 * 1024 * 1024;
export const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

/**
 * `null` si las imágenes valen; si no, el motivo para enseñárselo a quien envía. Se comprueba ANTES de
 * crear la tarea: una incidencia a medias (sin las imágenes que el usuario creyó mandar) es peor que
 * un «esta imagen no vale, quítala».
 */
export function problemaConImagenes(imagenes: { originalname: string; mimetype: string; size: number }[]): string | null {
  if (imagenes.length > MAX_IMAGENES) return `Como mucho ${MAX_IMAGENES} imágenes.`;
  for (const i of imagenes) {
    if (!(TIPOS_IMAGEN as readonly string[]).includes(i.mimetype)) return `«${i.originalname}» no es una imagen (PNG, JPG, WebP o GIF).`;
    if (i.size > MAX_IMAGEN_BYTES) return `«${i.originalname}» pesa más de 10 MB.`;
  }
  return null;
}
