import { Role } from '@yorga/contracts';

/** Lo mínimo que necesita el bootstrap del repo de usuarios y el hasher (para testearlo con fakes). */
export interface BootstrapAdminDeps {
  findByEmail(email: string): Promise<{ id: number } | null | undefined>;
  create(u: { email: string; name: string; passwordHash: string; role: Role }): Promise<{ id: number; email: string }>;
  hash(password: string): Promise<string>;
}

/**
 * Crea el PRIMER admin al arrancar la API, leyendo las credenciales del entorno
 * (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`).
 *
 * Por qué existe: en el despliegue (App Platform) no hay CLI a mano —la consola web no aguanta el
 * arranque de ts-node—, así que el alta del primer admin se hace por variables de entorno.
 *
 * Es **idempotente**: si el email ya existe, no hace nada. Puede correr en cada arranque sin duplicar,
 * y una vez creado el admin se pueden quitar las variables. Devuelve un mensaje para el log (no lanza:
 * un fallo aquí no debe tumbar la API, que ya está sirviendo).
 */
export async function bootstrapAdmin(deps: BootstrapAdminDeps, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  const name = env.ADMIN_NAME?.trim() || 'Admin';

  if (!email || !password) return 'sin ADMIN_EMAIL/ADMIN_PASSWORD → no se crea admin de arranque';
  if (await deps.findByEmail(email)) return `el admin ${email} ya existe → nada que hacer`;

  const passwordHash = await deps.hash(password);
  const user = await deps.create({ email, name, passwordHash, role: 'admin' });
  return `admin de arranque creado: #${user.id} ${user.email} (ya puedes quitar ADMIN_PASSWORD)`;
}
