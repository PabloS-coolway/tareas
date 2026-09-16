import nodemailer from 'nodemailer';

/**
 * Correo saliente, opcional. Con `SMTP_URL` (p. ej. smtps://usuario:clave@smtp.gmail.com:465) y `MAIL_FROM`
 * se envían correos; sin ellos, `enviar` devuelve false y la app avisa por otro camino.
 */
export function correoConfigurado(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!env.SMTP_URL && !!env.MAIL_FROM;
}

export async function enviarCorreo(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  if (!correoConfigurado()) return false;
  const transport = nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text, html });
  return true;
}
