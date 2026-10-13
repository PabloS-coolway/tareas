import nodemailer from 'nodemailer';
import { MensajeCorreo } from '../dominio/tipos';
import { DatosEnvio, Transporte } from '../puertos';

/** Cualquier servidor SMTP (un buzón del propio dominio, el relay de un proveedor…), por URL smtp(s)://. */
export class TransporteSmtp implements Transporte {
  constructor(private readonly url: string) {}

  async enviar(m: MensajeCorreo, d: DatosEnvio): Promise<{ idProveedor: string | null }> {
    const t = nodemailer.createTransport(this.url);
    try {
      const info = await t.sendMail({
        from: { name: d.remitente.nombre, address: d.remitente.email },
        to: m.para,
        subject: m.asunto,
        text: m.texto,
        html: m.html,
        ...(d.responderA ? { replyTo: d.responderA } : {}),
      });
      return { idProveedor: info.messageId ?? null };
    } catch (e) {
      throw new Error(`El servidor SMTP rechazó el envío: ${(e as Error).message}`);
    } finally {
      t.close();
    }
  }
}
