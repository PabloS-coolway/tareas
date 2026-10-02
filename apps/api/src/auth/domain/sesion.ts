import { User } from './user';

/** Lo que va dentro del JWT (mismo contrato que `JwtPayload` de auth.service). */
export interface DatosSesion {
  sub: number;
  email: string;
  name: string;
  role: User['role'];
}

/**
 * TAREAS-20 · La sesión vale lo que diga el usuario de la base AHORA, no lo que se firmó al entrar.
 * Con «Recordarme» un JWT dura 30 días: sin esto, un ascenso a admin no aplicaba hasta volver a entrar
 * (Nico, admin, no podía crear proyectos) y un usuario desactivado seguía entrando.
 * Devuelve null si el usuario ya no existe, está desactivado o no es la persona del token.
 */
export function sesionAlDia(token: DatosSesion, actual: User | null): DatosSesion | null {
  if (!actual || !actual.active || actual.id !== token.sub) return null;
  return { sub: actual.id, email: actual.email, name: actual.name, role: actual.role };
}
