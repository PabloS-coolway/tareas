import { sesionAlDia } from '../src/auth/domain/sesion';
import { User } from '../src/auth/domain/user';

const usuario = (p: Partial<User> = {}): User => ({
  id: 3,
  email: 'nico@coolway.com',
  name: 'Nico',
  passwordHash: 'x',
  role: 'admin',
  active: true,
  ...p,
});

describe('la sesión manda el usuario de la base, no el del token (TAREAS-20)', () => {
  it('lo ascendieron a admin con la sesión abierta: vale el rol de ahora', () => {
    const token = { sub: 3, email: 'nico@coolway.com', name: 'Nico', role: 'miembro' };
    expect(sesionAlDia(token, usuario())).toEqual({ sub: 3, email: 'nico@coolway.com', name: 'Nico', role: 'admin' });
  });

  it('le quitaron el admin: deja de serlo sin esperar a que caduque la sesión', () => {
    const token = { sub: 3, email: 'nico@coolway.com', name: 'Nico', role: 'admin' };
    expect(sesionAlDia(token, usuario({ role: 'miembro' }))?.role).toBe('miembro');
  });

  it('desactivado o borrado: sin sesión', () => {
    const token = { sub: 3, email: 'nico@coolway.com', name: 'Nico', role: 'admin' };
    expect(sesionAlDia(token, usuario({ active: false }))).toBeNull();
    expect(sesionAlDia(token, null)).toBeNull();
  });

  it('nunca cambia de persona aunque el token diga otra cosa', () => {
    const token = { sub: 3, email: 'otro@coolway.com', name: 'Otro', role: 'miembro' };
    expect(sesionAlDia(token, usuario({ id: 7 }))).toBeNull();
  });
});
