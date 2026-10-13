/**
 * Cómo llega el token al MCP remoto y, si no vale, por qué. Con un motivo concreto el cliente (y el log) dicen qué
 * falla en vez de quedarse esperando: Claude Code, ante un 401 genérico, intenta un login OAuth que aquí no existe.
 */

export type MotivoToken = 'sin-token' | 'sin-bearer' | 'bearer-vacio' | 'plantilla-sin-rellenar' | 'formato' | 'desconocido';

export interface TokenRecibido {
  /** El token a comprobar, o null si ni siquiera tiene forma de token. */
  token: string | null;
  /** Por qué no hay token utilizable (si token es null). */
  motivo: MotivoToken | null;
}

/** Saca el token de la ruta (/api/mcp/t/<token>) o de la cabecera Authorization, y si no puede, dice por qué. */
export function leerToken(authorization: string | undefined, tokenEnRuta: string | undefined): TokenRecibido {
  const leido = tokenEnRuta !== undefined ? { valor: tokenEnRuta.trim() } : extraerBearer(authorization);
  if ('motivo' in leido) return { token: null, motivo: leido.motivo };
  const crudo = leido.valor;
  if (!crudo) return { token: null, motivo: 'sin-token' };
  // Un cliente que no sustituye su configuración manda el texto tal cual, p. ej. "${user_config.tareas_token}".
  if (crudo.includes('${') || crudo.includes('%{') || crudo.includes('{{')) return { token: null, motivo: 'plantilla-sin-rellenar' };
  if (!crudo.startsWith('tk_')) return { token: null, motivo: 'formato' };
  return { token: crudo, motivo: null };
}

function extraerBearer(authorization: string | undefined): { valor: string } | { motivo: MotivoToken } {
  const cab = (authorization ?? '').trim();
  if (!cab) return { motivo: 'sin-token' };
  if (!/^bearer(\s|$)/i.test(cab)) return { motivo: 'sin-bearer' };
  const valor = cab.slice(6).trim();
  return valor ? { valor } : { motivo: 'bearer-vacio' };
}

const MENSAJES: Record<MotivoToken, string> = {
  'sin-token': 'No ha llegado ningún token. Envíalo como Authorization: Bearer tk_… o usa la URL /api/mcp/t/tk_….',
  'sin-bearer': 'La cabecera Authorization no empieza por «Bearer». Envíala como Authorization: Bearer tk_….',
  'bearer-vacio': 'La cabecera Authorization llega como «Bearer» sin token: tu cliente no ha rellenado el valor.',
  'plantilla-sin-rellenar':
    'El token llega como plantilla sin rellenar (p. ej. ${user_config.tareas_token}): tu cliente no ha sustituido el valor. Revisa la configuración del plugin o usa la URL /api/mcp/t/tk_….',
  formato: 'Eso no es un token de Tareas Yorga: los tokens empiezan por tk_.',
  desconocido: 'Token de API no válido o revocado. Crea uno nuevo en «Tokens de API».',
};

export function mensajeToken(motivo: MotivoToken): string {
  return MENSAJES[motivo];
}

/** Versión ASCII para la cabecera: Node rechaza acentos y comillas tipográficas en cabeceras (ERR_INVALID_CHAR). */
const DESCRIPCIONES_ASCII: Record<MotivoToken, string> = {
  'sin-token': 'no token received; send Authorization: Bearer tk_... or use /api/mcp/t/tk_...',
  'sin-bearer': 'Authorization header must start with Bearer',
  'bearer-vacio': 'Authorization header is Bearer with an empty token; the client did not fill the value',
  'plantilla-sin-rellenar': 'token is an unfilled template; the client did not substitute its configured value',
  formato: 'not a Tareas Yorga token (they start with tk_)',
  desconocido: 'invalid or revoked API token',
};

/**
 * Cabecera WWW-Authenticate del 401 (RFC 6750). Sin `resource_metadata`: no anunciamos servidor OAuth porque no lo hay.
 */
export function cabeceraWwwAuthenticate(motivo: MotivoToken): string {
  const error = motivo === 'desconocido' || motivo === 'formato' ? 'invalid_token' : 'invalid_request';
  return `Bearer realm="tareas-yorga", error="${error}", error_description="${DESCRIPCIONES_ASCII[motivo]}"`;
}
