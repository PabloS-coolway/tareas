import { ConfigCorreo, IdMensaje, MensajeCorreo, MensajeEnCola, Propietario, RegistroCorreo, Remitente } from './dominio/tipos';

/** Dónde se guarda la configuración (una por propietario). */
export interface AlmacenConfigCorreo {
  leer(propietario: Propietario): Promise<ConfigCorreo | null>;
  guardar(propietario: Propietario, config: ConfigCorreo): Promise<void>;
}

/** Cola de envío y registro a la vez: un mensaje encolado es una línea del registro. */
export interface ColaCorreo {
  encolar(propietario: Propietario, mensaje: MensajeCorreo, cuando: Date): Promise<IdMensaje>;
  /** Pendientes cuyo próximo intento ya ha llegado, los más antiguos primero. */
  pendientes(ahora: Date, limite: number): Promise<MensajeEnCola[]>;
  marcarEnviado(id: IdMensaje, intentos: number, idProveedor: string | null, cuando: Date): Promise<void>;
  /** `proximo` null = no se reintenta más (queda fallido). */
  marcarFallo(id: IdMensaje, intentos: number, error: string, proximo: Date | null): Promise<void>;
  /** Descarta (como fallidos) los pendientes de un propietario cuyo tipo empieza por `prefijoTipo`. */
  descartarPendientes(propietario: Propietario, prefijoTipo: string, motivo: string): Promise<number>;
  registro(propietario: Propietario, limite: number): Promise<RegistroCorreo[]>;
  purgar(antesDe: Date): Promise<number>;
}

export interface DatosEnvio {
  remitente: Remitente;
  responderA: string | null;
}

/** Un proveedor concreto. Lanza un Error con un mensaje legible si el proveedor rechaza el envío. */
export interface Transporte {
  enviar(mensaje: MensajeCorreo, datos: DatosEnvio): Promise<{ idProveedor: string | null }>;
}
