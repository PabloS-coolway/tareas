import { CambioConfigCorreo, ErrorCorreo, Marca, PROVEEDORES, Proveedor, Remitente } from './tipos';

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function esEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL.test(v.trim());
}

function esUrlWeb(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Comprueba la credencial según el proveedor. Devuelve el mensaje de error o null si vale. */
export function errorDeCredencial(proveedor: Proveedor, credencial: string): string | null {
  const c = credencial.trim();
  if (!c) return 'Falta la clave del proveedor.';
  if (proveedor === 'smtp') {
    try {
      const u = new URL(c);
      if (u.protocol !== 'smtp:' && u.protocol !== 'smtps:') return 'La URL SMTP debe empezar por smtp:// o smtps://.';
      if (!u.hostname) return 'La URL SMTP no tiene servidor.';
    } catch {
      return 'La URL SMTP no es válida (p. ej. smtps://usuario:clave@smtp.ejemplo.com:465).';
    }
    return null;
  }
  if (c.length < 20 || /\s/.test(c)) return 'La clave de API no parece válida.';
  return null;
}

/**
 * Normaliza y valida lo que llega del panel. `hayCredencialGuardada` dice si se puede omitir la credencial
 * (se conserva la anterior). Lanza ErrorCorreo con un mensaje para quien administra.
 */
export function validarCambio(c: CambioConfigCorreo, hayCredencialGuardada: boolean): CambioConfigCorreo {
  if (!c || typeof c !== 'object') throw new ErrorCorreo('Faltan los datos de la configuración.');
  if (!PROVEEDORES.includes(c.proveedor)) throw new ErrorCorreo('Elige un proveedor válido.');
  const credencial = typeof c.credencial === 'string' ? c.credencial.trim() : '';
  if (credencial) {
    const err = errorDeCredencial(c.proveedor, credencial);
    if (err) throw new ErrorCorreo(err);
  } else if (!hayCredencialGuardada) {
    throw new ErrorCorreo(c.proveedor === 'smtp' ? 'Falta la URL del servidor SMTP.' : 'Falta la clave de API del proveedor.');
  }
  const remitente: Remitente = { nombre: String(c.remitente?.nombre ?? '').trim(), email: String(c.remitente?.email ?? '').trim() };
  if (!remitente.nombre) throw new ErrorCorreo('Pon el nombre del remitente.');
  if (!esEmail(remitente.email)) throw new ErrorCorreo('La dirección del remitente no es válida.');
  const responderA = typeof c.responderA === 'string' && c.responderA.trim() ? c.responderA.trim() : null;
  if (responderA && !esEmail(responderA)) throw new ErrorCorreo('La dirección de respuesta no es válida.');
  const marca: Marca = {
    nombre: String(c.marca?.nombre ?? '').trim(),
    url: String(c.marca?.url ?? '').trim().replace(/\/+$/, ''),
    pie: String(c.marca?.pie ?? '').trim(),
    prefijoAsunto: String(c.marca?.prefijoAsunto ?? '').trim(),
  };
  if (!marca.nombre) throw new ErrorCorreo('Pon el nombre de la app.');
  if (!esUrlWeb(marca.url)) throw new ErrorCorreo('La URL pública de la app no es válida (https://…).');
  if (marca.pie.length > 500) throw new ErrorCorreo('El pie es demasiado largo (máx. 500 caracteres).');
  if ((marca.prefijoAsunto ?? '').length > 30) throw new ErrorCorreo('La etiqueta del asunto es demasiado larga (máx. 30 caracteres).');
  return { proveedor: c.proveedor, credencial: credencial || null, remitente, responderA, marca, avisosActivos: c.avisosActivos === true };
}

/** «••••abcd» (o «••••» si no se guarda ningún carácter): lo único que se enseña de una credencial guardada. */
export function enmascarar(final: string | null): string | null {
  return final === null ? null : `••••${final}`;
}

/**
 * Lo que se guarda para enseñarla enmascarada: los 4 últimos caracteres de una clave de API. De una URL SMTP,
 * nada: lleva la contraseña de un buzón y hasta 4 caracteres de ella son demasiados.
 */
export function finalDeCredencial(proveedor: Proveedor, credencial: string): string {
  return proveedor === 'smtp' ? '' : credencial.trim().slice(-4);
}

/** El asunto con la etiqueta de la marca delante (si la hay). */
export function conEtiqueta(marca: Marca, asunto: string): string {
  const e = marca.prefijoAsunto?.trim();
  return e ? `${e} ${asunto}` : asunto;
}
