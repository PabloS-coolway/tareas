import { JwtModuleOptions } from '@nestjs/jwt';

/** Secreto de desarrollo. SÓLO vale fuera de producción (ver `resolveJwtSecret`). */
export const DEV_SECRET = 'dev-only-coolway-secret-cambiar-en-produccion';

/**
 * Resuelve el secreto con el que se firman los tokens.
 *
 * ⚠️ En **producción** `JWT_SECRET` es OBLIGATORIO: si no está, la app **no arranca**. Con el secreto
 * de desarrollo desplegado, cualquiera podría firmarse un token de admin y entrar. Preferimos caer al
 * arrancar (visible, se corrige al momento) que servir con una puerta abierta.
 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (env.NODE_ENV === 'production' && !secret) {
    throw new Error(
      'JWT_SECRET no está definido. En producción es obligatorio (con el secreto de desarrollo, ' +
        'los tokens serían falsificables). Defínelo en el entorno y vuelve a desplegar.',
    );
  }
  return secret ?? DEV_SECRET;
}

/**
 * Configuración del JWT. En local usa un secreto por defecto; en producción `JWT_SECRET` es obligatorio.
 */
export function jwtOptions(): JwtModuleOptions {
  return {
    secret: resolveJwtSecret(),
    // expiresIn admite formato de `ms` (p.ej. '12h', '7d'); el tipo es estricto, de ahí el cast.
    signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as `${number}h` },
  };
}
