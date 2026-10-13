/** Correo saliente (pantalla de admin «Correo»). Fechas en ISO. */

export type ProveedorCorreo = 'brevo' | 'smtp';

/** GET /admin/correo — la credencial nunca va entera: «••••abcd» o null. */
export interface CorreoConfigDto {
  /** De dónde sale el correo ahora: configuración del panel, SMTP de variables de entorno o nada. */
  origen: 'panel' | 'entorno' | 'ninguno';
  /** Sin clave maestra en el servidor no se puede guardar una credencial. */
  claveMaestraDisponible: boolean;
  proveedor: ProveedorCorreo | null;
  credencial: string | null;
  remitente: { nombre: string; email: string } | null;
  responderA: string | null;
  marca: { nombre: string; url: string; pie: string; prefijoAsunto?: string } | null;
  avisosActivos: boolean;
  avisosDesde: string | null;
  actualizadoEn: string | null;
  actualizadoPor: string | null;
  /** Valores por defecto para el formulario cuando aún no hay nada guardado. */
  sugerencia: { remitenteNombre: string; marcaNombre: string; url: string };
}

/** PUT /admin/correo — `credencial` vacía o ausente = conservar la guardada (si es del mismo proveedor). */
export interface GuardarCorreoConfigDto {
  proveedor: ProveedorCorreo;
  credencial?: string | null;
  remitente: { nombre: string; email: string };
  responderA?: string | null;
  marca: { nombre: string; url: string; pie: string; prefijoAsunto?: string };
  avisosActivos: boolean;
}

/** POST /admin/correo/prueba */
export interface CorreoPruebaDto {
  para: string;
}
export interface CorreoPruebaResultadoDto {
  ok: boolean;
  error: string | null;
}

/** GET /admin/correo/registro */
export interface CorreoRegistroDto {
  id: number;
  para: string;
  asunto: string;
  tipo: string;
  estado: 'pendiente' | 'enviado' | 'fallido';
  intentos: number;
  error: string | null;
  creadoEn: string;
  enviadoEn: string | null;
  proximoIntento: string | null;
}
