import { TransporteSmtp, esEmail, type Envio } from '@modulos/correo';

/**
 * Correo de reserva por variables de entorno (lo que había antes del panel): `SMTP_URL` y `MAIL_FROM`
 * («Nombre <correo@dominio>» o solo la dirección). Solo se usa si no hay nada guardado en el panel.
 */
export function reservaDesdeEntorno(env: NodeJS.ProcessEnv = process.env): Envio | null {
  const url = env.SMTP_URL?.trim();
  const from = env.MAIL_FROM?.trim();
  if (!url || !from) return null;
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  const email = (m ? m[2] : from).trim();
  if (!esEmail(email)) return null;
  const nombre = (m?.[1] ?? '').trim() || email;
  return { transporte: new TransporteSmtp(url), datos: { remitente: { nombre, email }, responderA: null } };
}
