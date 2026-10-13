import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { ServicioCorreo, type AlmacenConfigCorreo, type ColaCorreo, type ConfigCorreo, type MensajeCorreo } from '@modulos/correo';
import { reservaDesdeEntorno } from '../src/correo/infrastructure/reserva-entorno';
import { CorreoController } from '../src/correo/interface/http/correo.controller';
import { FEATURES_KEY } from '../src/auth/interface/http/decorators';
import { AuthService } from '../src/auth/application/auth.service';

describe('correo de reserva por variables de entorno', () => {
  it('sin SMTP_URL o MAIL_FROM no hay reserva', () => {
    expect(reservaDesdeEntorno({})).toBeNull();
    expect(reservaDesdeEntorno({ SMTP_URL: 'smtps://u:p@smtp.x.com:465' })).toBeNull();
  });
  it('acepta «Nombre <correo>» y solo la dirección', () => {
    expect(reservaDesdeEntorno({ SMTP_URL: 'smtps://u:p@smtp.x.com:465', MAIL_FROM: 'Tareas Yorga <tareas@coolway.com>' })?.datos.remitente).toEqual({ nombre: 'Tareas Yorga', email: 'tareas@coolway.com' });
    expect(reservaDesdeEntorno({ SMTP_URL: 'smtps://u:p@smtp.x.com:465', MAIL_FROM: 'tareas@coolway.com' })?.datos.remitente).toEqual({ nombre: 'tareas@coolway.com', email: 'tareas@coolway.com' });
  });
});

describe('pantalla de correo: solo quien gestiona usuarios', () => {
  it.each(['leer', 'guardar', 'probar', 'registro'] as const)('%s exige usuarios.gestionar', (m) => {
    expect(Reflect.getMetadata(FEATURES_KEY, CorreoController.prototype[m])).toEqual(['usuarios.gestionar']);
  });
});

/** «He olvidado mi contraseña» con el motor de correo (con y sin correo configurado). */
describe('restablecer contraseña', () => {
  const catalina = { id: 7, email: 'catalina@coolway.com', name: 'Catalina', active: true, role: 'miembro' };
  const admin = { id: 1, email: 'pablo.silva@coolway.com', name: 'PabloS', active: true, role: 'admin' };

  function montar(config: ConfigCorreo | null) {
    const encolados: MensajeCorreo[] = [];
    const avisos: unknown[] = [];
    const almacen: AlmacenConfigCorreo = { leer: async () => config, guardar: async () => undefined };
    const cola = { encolar: async (_p: string, m: MensajeCorreo) => (encolados.push(m), 1), pendientes: async () => [], purgar: async () => 0 } as unknown as ColaCorreo;
    const correo = new ServicioCorreo({ almacen, cola, claveMaestra: randomBytes(32), marcaPorDefecto: { nombre: 'Tareas', url: 'http://localhost', pie: '' } });
    const users = { findByEmail: async (e: string) => (e === catalina.email ? catalina : null), list: async () => [admin, catalina] };
    const prisma = { passwordReset: { create: async () => ({}) }, notification: { createMany: async (a: { data: unknown[] }) => avisos.push(...a.data) } };
    const auth = new AuthService(users as never, {} as never, {} as never, {} as never, prisma as never, correo);
    return { auth, encolados, avisos };
  }

  const conBrevo = (marca = { nombre: 'Tareas Yorga', url: 'https://tareas.test', pie: '' }): ConfigCorreo => ({
    proveedor: 'brevo',
    credencialCifrada: 'v1:a:b:c',
    credencialFinal: 'WXYZ',
    remitente: { nombre: 'Tareas Yorga', email: 'tareas@coolway.com' },
    responderA: null,
    marca,
    avisosActivos: false,
    avisosDesde: null,
    actualizadoEn: new Date(),
    actualizadoPor: null,
  });

  it('con correo configurado, encola el enlace para la persona y no avisa a los admins', async () => {
    const { auth, encolados, avisos } = montar(conBrevo());
    jest.spyOn(ServicioCorreo.prototype, 'disponible').mockResolvedValue(true);
    await auth.forgotPassword('Catalina@coolway.com ', 'https://tareas.test/');
    expect(encolados).toHaveLength(1);
    expect(encolados[0]).toMatchObject({ para: 'catalina@coolway.com', tipo: 'contrasena', asunto: 'Restablecer tu contraseña · Tareas Yorga' });
    expect(encolados[0].texto).toMatch(/https:\/\/tareas\.test\/restablecer\?token=/);
    expect(avisos).toHaveLength(0);
    jest.restoreAllMocks();
  });

  it('sin correo, avisa a los admins en la app', async () => {
    const { auth, encolados, avisos } = montar(null);
    const antes = { url: process.env.SMTP_URL, from: process.env.MAIL_FROM };
    delete process.env.SMTP_URL;
    delete process.env.MAIL_FROM;
    await auth.forgotPassword('catalina@coolway.com', 'https://tareas.test');
    Object.assign(process.env, antes.url ? { SMTP_URL: antes.url } : {}, antes.from ? { MAIL_FROM: antes.from } : {});
    expect(encolados).toHaveLength(0);
    expect(avisos).toEqual([expect.objectContaining({ userId: 1, type: 'PASSWORD_RESET' })]);
  });

  it('una dirección que no existe no envía nada ni avisa a nadie', async () => {
    const { auth, encolados, avisos } = montar(conBrevo());
    await auth.forgotPassword('noexiste@coolway.com', 'https://tareas.test');
    expect(encolados).toHaveLength(0);
    expect(avisos).toHaveLength(0);
  });
});
