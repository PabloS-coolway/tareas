import { MensajeCorreo } from '../dominio/tipos';
import { DatosEnvio, Transporte } from '../puertos';

export const URL_BREVO = 'https://api.brevo.com/v3/smtp/email';

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Brevo (antes Sendinblue) por su API de correo transaccional. */
export class TransporteBrevo implements Transporte {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: Fetch = globalThis.fetch as unknown as Fetch,
  ) {}

  async enviar(m: MensajeCorreo, d: DatosEnvio): Promise<{ idProveedor: string | null }> {
    const res = await this.fetcher(URL_BREVO, {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: d.remitente.nombre, email: d.remitente.email },
        to: [{ email: m.para }],
        subject: m.asunto,
        htmlContent: m.html,
        textContent: m.texto,
        ...(d.responderA ? { replyTo: { email: d.responderA } } : {}),
      }),
    });
    const cuerpo = await res.text().catch(() => '');
    let json: { messageId?: string; message?: string; code?: string } = {};
    try {
      json = cuerpo ? JSON.parse(cuerpo) : {};
    } catch {
      /* respuesta no JSON */
    }
    if (!res.ok) {
      const detalle = json.message ?? (cuerpo.slice(0, 200) || 'sin detalle');
      throw new Error(`Brevo rechazó el envío (${res.status}): ${detalle}`);
    }
    return { idProveedor: json.messageId ?? null };
  }
}
