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

/** Preferencias de correo de la persona de la sesión (GET/PUT /me/correo). */
export interface CorreoPreferenciasDto {
  /** Interruptor personal: apagado, ningún aviso por correo. */
  activo: boolean;
  /** Claves de los tipos de aviso que quiere por correo. */
  tipos: string[];
  /** Proyectos: todos, solo estos o todos menos estos. */
  ambitos: { modo: 'todos' | 'solo' | 'silenciar'; ids: number[] };
  /** Índice en `niveles` (prioridad mínima) o null = todas. */
  nivelMinimo: number | null;
  modo: 'inmediato' | 'resumen';
}

/** GET /me/correo: lo guardado más lo que hace falta para pintar la pantalla. */
export interface PerfilCorreoDto {
  preferencias: CorreoPreferenciasDto;
  catalogo: { clave: string; etiqueta: string; porDefecto: boolean }[];
  /** Escala de la prioridad mínima, de menos a más. */
  niveles: { valor: number; etiqueta: string }[];
  /** «de lunes a viernes a las 8:00 (hora de Madrid)». */
  horarioResumen: string;
  /** Si el admin tiene encendidos los avisos por correo (si no, no llega nada a nadie). */
  avisosCorreoActivos: boolean;
}
