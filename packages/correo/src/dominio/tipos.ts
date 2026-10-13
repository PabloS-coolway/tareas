/** Proveedores de correo que sabe usar el motor. Añadir uno = un transporte nuevo + su valor aquí. */
export const PROVEEDORES = ['brevo', 'smtp'] as const;
export type Proveedor = (typeof PROVEEDORES)[number];

export const PROVEEDOR_ETIQUETAS: Record<Proveedor, string> = {
  brevo: 'Brevo (API)',
  smtp: 'SMTP',
};

/**
 * De quién es una configuración. Una app con un solo cliente usa siempre el mismo valor; una app multiempresa,
 * el id de la empresa.
 */
export type Propietario = string;

export interface Remitente {
  nombre: string;
  email: string;
}

/** Lo que pone la marca en las plantillas. */
export interface Marca {
  /** Nombre de la app, p. ej. «Tareas Acme». */
  nombre: string;
  /** URL pública de la app, sin barra final; los enlaces de los correos parten de aquí. */
  url: string;
  /** Texto del pie (una o dos líneas). */
  pie: string;
}

/** Configuración tal como se guarda: la credencial va cifrada. */
export interface ConfigCorreo {
  proveedor: Proveedor;
  /** Clave de API (Brevo) o URL del servidor (SMTP), cifrada con la clave maestra. */
  credencialCifrada: string | null;
  /** Últimos 4 caracteres de la credencial, para enseñarla enmascarada. */
  credencialFinal: string | null;
  remitente: Remitente;
  responderA: string | null;
  marca: Marca;
  /** Interruptor general de avisos por correo. */
  avisosActivos: boolean;
  /** Desde cuándo están activos: lo anterior no se envía. */
  avisosDesde: Date | null;
  actualizadoEn: Date;
  actualizadoPor: string | null;
}

/** Lo que se envía desde el panel para guardar. Credencial vacía o ausente = mantener la guardada. */
export interface CambioConfigCorreo {
  proveedor: Proveedor;
  credencial?: string | null;
  remitente: Remitente;
  responderA?: string | null;
  marca: Marca;
  avisosActivos: boolean;
}

/** De dónde sale el correo ahora mismo. */
export type OrigenCorreo = 'panel' | 'entorno' | 'ninguno';

/** Lo que ve el panel: nunca la credencial entera. */
export interface ConfigCorreoPanel {
  origen: OrigenCorreo;
  /** Si el servidor tiene clave maestra (sin ella no se puede guardar una credencial). */
  claveMaestraDisponible: boolean;
  proveedor: Proveedor | null;
  /** «••••abcd» o null si no hay credencial guardada. */
  credencial: string | null;
  remitente: Remitente | null;
  responderA: string | null;
  marca: Marca | null;
  avisosActivos: boolean;
  avisosDesde: Date | null;
  actualizadoEn: Date | null;
  actualizadoPor: string | null;
}

export interface MensajeCorreo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
  /** Para el registro y para descartar por tipo (p. ej. «aviso.asignada», «contrasena»). */
  tipo: string;
}

export type IdMensaje = string | number;

export const ESTADOS_ENVIO = ['pendiente', 'enviado', 'fallido'] as const;
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

export interface MensajeEnCola extends MensajeCorreo {
  id: IdMensaje;
  propietario: Propietario;
  intentos: number;
}

/** Una línea del registro de envíos. */
export interface RegistroCorreo {
  id: IdMensaje;
  para: string;
  asunto: string;
  tipo: string;
  estado: EstadoEnvio;
  intentos: number;
  error: string | null;
  creadoEn: Date;
  enviadoEn: Date | null;
  proximoIntento: Date | null;
}

export interface ResultadoPrueba {
  ok: boolean;
  error: string | null;
}

/** Error de configuración o de uso que se puede enseñar tal cual a quien administra. */
export class ErrorCorreo extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorCorreo';
  }
}
