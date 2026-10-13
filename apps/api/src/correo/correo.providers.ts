import { Provider } from '@nestjs/common';
import { ServicioCorreo, leerClaveMaestra } from '@modulos/correo';
import { PrismaAlmacenConfigCorreo } from './infrastructure/prisma-almacen-config';
import { PrismaColaCorreo } from './infrastructure/prisma-cola-correo';
import { reservaDesdeEntorno } from './infrastructure/reserva-entorno';

/** Tareas tiene un solo propietario de configuración de correo (Atalaya usará uno por empresa). */
export const PROPIETARIO_CORREO = 'default';

/** URL pública de la app para los enlaces de los correos (sin barra final). */
export function urlPublica(env: NodeJS.ProcessEnv = process.env): string {
  return (env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

/**
 * Proveedores del correo. Van en AuthModule (que ya provee PrismaService y lo necesita para «He olvidado mi
 * contraseña») para no crear un ciclo entre módulos.
 */
export const correoProviders: Provider[] = [
  PrismaAlmacenConfigCorreo,
  PrismaColaCorreo,
  {
    provide: ServicioCorreo,
    inject: [PrismaAlmacenConfigCorreo, PrismaColaCorreo],
    useFactory: (almacen: PrismaAlmacenConfigCorreo, cola: PrismaColaCorreo) =>
      new ServicioCorreo({
        almacen,
        cola,
        claveMaestra: leerClaveMaestra(process.env.MAIL_ENCRYPTION_KEY),
        reserva: () => reservaDesdeEntorno(),
        marcaPorDefecto: { nombre: 'Tareas', url: urlPublica(), pie: '' },
      }),
  },
];
