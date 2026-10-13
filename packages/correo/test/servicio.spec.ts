import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_INTENTOS,
  ServicioCorreo,
  TransporteBrevo,
  URL_BREVO,
  type AlmacenConfigCorreo,
  type CambioConfigCorreo,
  type ColaCorreo,
  type ConfigCorreo,
  type MensajeCorreo,
  type MensajeEnCola,
  type RegistroCorreo,
  type Transporte,
} from '../src';

class AlmacenMemoria implements AlmacenConfigCorreo {
  datos = new Map<string, ConfigCorreo>();
  async leer(p: string) {
    return this.datos.get(p) ?? null;
  }
  async guardar(p: string, c: ConfigCorreo) {
    this.datos.set(p, c);
  }
}

class ColaMemoria implements ColaCorreo {
  filas: (RegistroCorreo & MensajeEnCola)[] = [];
  async encolar(propietario: string, m: MensajeCorreo, cuando: Date) {
    const id = this.filas.length + 1;
    this.filas.push({ ...m, id, propietario, intentos: 0, estado: 'pendiente', error: null, creadoEn: cuando, enviadoEn: null, proximoIntento: cuando });
    return id;
  }
  async pendientes(ahora: Date, limite: number) {
    return this.filas.filter((f) => f.estado === 'pendiente' && f.proximoIntento! <= ahora).slice(0, limite);
  }
  async marcarEnviado(id: number | string, intentos: number, _idp: string | null, cuando: Date) {
    Object.assign(this.filas.find((f) => f.id === id)!, { estado: 'enviado', intentos, enviadoEn: cuando, proximoIntento: null });
  }
  async marcarFallo(id: number | string, intentos: number, error: string, proximo: Date | null) {
    Object.assign(this.filas.find((f) => f.id === id)!, { estado: proximo ? 'pendiente' : 'fallido', intentos, error, proximoIntento: proximo });
  }
  async descartarPendientes(p: string, prefijo: string, motivo: string) {
    const fs = this.filas.filter((f) => f.propietario === p && f.estado === 'pendiente' && f.tipo.startsWith(prefijo));
    fs.forEach((f) => Object.assign(f, { estado: 'fallido', error: motivo, proximoIntento: null }));
    return fs.length;
  }
  async registro(p: string, limite: number) {
    return this.filas.filter((f) => f.propietario === p).slice(0, limite);
  }
  async purgar() {
    return 0;
  }
}

const cambio: CambioConfigCorreo = {
  proveedor: 'brevo',
  credencial: 'xkeysib-0123456789abcdef0123456789abcdef-WXYZ',
  remitente: { nombre: 'Tareas Acme', email: 'tareas@acme.test' },
  marca: { nombre: 'Tareas Acme', url: 'https://tareas.acme.test', pie: '' },
  avisosActivos: false,
};
const msg: MensajeCorreo = { para: 'ana@acme.test', asunto: 'WEB-12 · Hola', html: '<p>x</p>', texto: 'x', tipo: 'aviso.asignada' };

function montar(transporte?: Transporte, claveMaestra: Buffer | null = randomBytes(32)) {
  let ahora = new Date('2026-10-13T10:00:00Z');
  const almacen = new AlmacenMemoria();
  const cola = new ColaMemoria();
  const credenciales: string[] = [];
  const t: Transporte = transporte ?? { enviar: vi.fn(async () => ({ idProveedor: 'id-1' })) };
  const s = new ServicioCorreo({
    almacen,
    cola,
    claveMaestra,
    marcaPorDefecto: { nombre: 'App', url: 'http://localhost', pie: '' },
    fabrica: (_p, c) => (credenciales.push(c), t),
    reloj: () => ahora,
  });
  return { s, almacen, cola, t, credenciales, avanzar: (min: number) => (ahora = new Date(ahora.getTime() + min * 60_000)) };
}

describe('configuración', () => {
  it('guarda la credencial cifrada y nunca la devuelve entera', async () => {
    const { s, almacen } = montar();
    const panel = await s.configurar('default', cambio, 'Ana');
    expect(panel.credencial).toBe('••••WXYZ');
    expect(JSON.stringify(panel)).not.toContain(cambio.credencial);
    expect(almacen.datos.get('default')!.credencialCifrada).not.toContain('xkeysib');
  });
  it('cambiar el remitente sin credencial conserva la guardada y se sigue pudiendo enviar', async () => {
    const { s, credenciales } = montar();
    await s.configurar('default', cambio, null);
    await s.configurar('default', { ...cambio, credencial: '', remitente: { nombre: 'Otro', email: 'otro@acme.test' } }, null);
    expect((await s.probar('default', 'ana@acme.test')).ok).toBe(true);
    expect(credenciales.at(-1)).toBe(cambio.credencial);
  });
  it('sin clave maestra no se puede guardar una credencial', async () => {
    const { s } = montar(undefined, null);
    await expect(s.configurar('default', cambio, null)).rejects.toThrow('clave maestra');
  });
  it('encender los avisos fija desde cuándo; apagarlos descarta los pendientes de avisos', async () => {
    const { s, cola } = montar();
    const on = await s.configurar('default', { ...cambio, avisosActivos: true }, null);
    expect(on.avisosDesde).toEqual(new Date('2026-10-13T10:00:00Z'));
    await s.encolar('default', msg);
    await s.encolar('default', { ...msg, tipo: 'contrasena' });
    await s.configurar('default', { ...cambio, credencial: '', avisosActivos: false }, null);
    expect(cola.filas.map((f) => f.estado)).toEqual(['fallido', 'pendiente']);
  });
});

describe('cola', () => {
  it('envía los pendientes', async () => {
    const { s, cola } = montar();
    await s.configurar('default', cambio, null);
    await s.encolar('default', msg);
    expect(await s.procesarCola()).toEqual({ enviados: 1, reintentos: 0, fallidos: 0 });
    expect(cola.filas[0].estado).toBe('enviado');
  });
  it('si el proveedor falla, reintenta más tarde y al final queda fallido con el error', async () => {
    const t: Transporte = { enviar: vi.fn(async () => Promise.reject(new Error('Brevo rechazó el envío (401): Key not found'))) };
    const { s, cola, avanzar } = montar(t);
    await s.configurar('default', cambio, null);
    await s.encolar('default', msg);
    await s.procesarCola();
    expect(cola.filas[0]).toMatchObject({ estado: 'pendiente', intentos: 1 });
    expect(await s.procesarCola()).toEqual({ enviados: 0, reintentos: 0, fallidos: 0 }); // aún no toca
    for (let i = 1; i < MAX_INTENTOS; i++) {
      avanzar(61);
      await s.procesarCola();
    }
    expect(cola.filas[0]).toMatchObject({ estado: 'fallido', intentos: MAX_INTENTOS, error: 'Brevo rechazó el envío (401): Key not found' });
  });
  it('sin configuración ni reserva, el correo falla con un motivo claro', async () => {
    const { s, cola } = montar();
    await s.encolar('default', msg);
    await s.procesarCola();
    expect(cola.filas[0].error).toBe('No hay correo configurado.');
  });
});

describe('prueba', () => {
  it('dice el error del proveedor', async () => {
    const t: Transporte = { enviar: async () => Promise.reject(new Error('Brevo rechazó el envío (401): Key not found')) };
    const { s } = montar(t);
    await s.configurar('default', cambio, null);
    expect(await s.probar('default', 'ana@acme.test')).toEqual({ ok: false, error: 'Brevo rechazó el envío (401): Key not found' });
    expect((await s.probar('default', 'mal')).ok).toBe(false);
  });
});

describe('transporte Brevo', () => {
  it('llama a su API con la clave en la cabecera y el remitente', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 201, text: async () => '{"messageId":"<abc@brevo>"}' }));
    const r = await new TransporteBrevo('xkeysib-1', fetcher).enviar(msg, { remitente: { nombre: 'Tareas Acme', email: 'tareas@acme.test' }, responderA: 'soporte@acme.test' });
    expect(r.idProveedor).toBe('<abc@brevo>');
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe(URL_BREVO);
    expect(init.headers['api-key']).toBe('xkeysib-1');
    expect(JSON.parse(init.body)).toMatchObject({ sender: { email: 'tareas@acme.test' }, to: [{ email: 'ana@acme.test' }], subject: 'WEB-12 · Hola', replyTo: { email: 'soporte@acme.test' } });
  });
  it('convierte el error de Brevo en un mensaje legible', async () => {
    const fetcher = async () => ({ ok: false, status: 401, text: async () => '{"code":"unauthorized","message":"Key not found"}' });
    await expect(new TransporteBrevo('x', fetcher).enviar(msg, { remitente: { nombre: 'A', email: 'a@acme.test' }, responderA: null })).rejects.toThrow('Brevo rechazó el envío (401): Key not found');
  });
});
