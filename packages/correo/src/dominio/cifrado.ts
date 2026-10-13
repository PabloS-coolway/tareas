import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ErrorCorreo } from './tipos';

/**
 * Cifrado de la credencial del proveedor con AES-256-GCM. La clave maestra (32 bytes en base64) vive en una
 * variable de entorno del servidor, nunca en la base de datos. Formato guardado: `v1:<iv>:<tag>:<datos>` (base64).
 */
const VERSION = 'v1';

export function leerClaveMaestra(base64: string | null | undefined): Buffer | null {
  if (!base64) return null;
  const k = Buffer.from(base64.trim(), 'base64');
  return k.length === 32 ? k : null;
}

export function cifrar(texto: string, clave: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave, iv);
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [VERSION, iv.toString('base64'), c.getAuthTag().toString('base64'), datos.toString('base64')].join(':');
}

export function descifrar(guardado: string, clave: Buffer): string {
  const [version, iv, tag, datos] = guardado.split(':');
  if (version !== VERSION || !iv || !tag || !datos) throw new ErrorCorreo('La credencial guardada tiene un formato desconocido.');
  try {
    const d = createDecipheriv('aes-256-gcm', clave, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(datos, 'base64')), d.final()]).toString('utf8');
  } catch {
    throw new ErrorCorreo('No se puede leer la credencial guardada: la clave maestra del servidor ha cambiado. Vuelve a pegar la clave del proveedor.');
  }
}
