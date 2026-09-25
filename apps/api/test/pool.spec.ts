import { conTopeDeConexiones } from '../src/infrastructure/db/pool';

describe('tope de conexiones a la base de datos', () => {
  it('lo añade a una URL sin parámetros', () => {
    expect(conTopeDeConexiones('postgresql://u:p@h:5432/db', 5)).toBe('postgresql://u:p@h:5432/db?connection_limit=5');
  });

  it('lo añade detrás de los parámetros que ya hay (sslmode de DigitalOcean)', () => {
    expect(conTopeDeConexiones('postgresql://u:p@h:25060/db?sslmode=require', 5)).toBe('postgresql://u:p@h:25060/db?sslmode=require&connection_limit=5');
  });

  it('respeta un connection_limit puesto a mano', () => {
    expect(conTopeDeConexiones('postgresql://h/db?connection_limit=12', 5)).toBe('postgresql://h/db?connection_limit=12');
  });

  it('sin URL no inventa nada', () => {
    expect(conTopeDeConexiones(undefined, 5)).toBeUndefined();
  });
});
