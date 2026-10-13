/**
 * Motor de correo saliente portable. Sin marca ni framework: la app que lo usa implementa los puertos
 * (configuración, cola) y decide qué correos encolar.
 */
export * from './dominio/tipos';
export { cifrar, descifrar, leerClaveMaestra } from './dominio/cifrado';
export { componer, escapar, type ContenidoCorreo } from './dominio/plantilla';
export { ESPERAS_MINUTOS, MAX_INTENTOS, siguienteIntento } from './dominio/reintentos';
export { conEtiqueta, enmascarar, errorDeCredencial, esEmail, finalDeCredencial, validarCambio } from './dominio/validacion';
export type { AlmacenConfigCorreo, ColaCorreo, DatosEnvio, Transporte } from './puertos';
export { crearTransporte, TransporteBrevo, TransporteSmtp, URL_BREVO } from './transportes';
export { PREFIJO_AVISOS, ServicioCorreo, type Envio, type OpcionesServicioCorreo, type ResultadoCola } from './servicio';
