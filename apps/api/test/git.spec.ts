import { clavesEnTexto, primeraLinea } from '../src/tareas/domain/git';

const P = ['COOL', 'TAREAS', 'SASS-IA', 'INC'];

describe('claves de tarea en mensajes de git', () => {
  it('encuentra las claves de proyectos que existen', () => {
    expect(clavesEnTexto('Seguidores con avisos (TAREAS-6) y fix COOL-32', P)).toEqual(['TAREAS-6', 'COOL-32']);
  });
  it('proyectos con guion en la clave', () => {
    expect(clavesEnTexto('SASS-IA-12: multitenant', P)).toEqual(['SASS-IA-12']);
  });
  it('ignora lo que parece una clave pero no es de ningún proyecto', () => {
    expect(clavesEnTexto('sha-256, UTF-8, ISO-8601 y ABC-12', P)).toEqual([]);
  });
  it('no repite y normaliza ceros', () => {
    expect(clavesEnTexto('COOL-032 … otra vez COOL-32', P)).toEqual(['COOL-32']);
  });
  it('no confunde un trozo de otra palabra', () => {
    expect(clavesEnTexto('XCOOL-3 y COOL-3x', P)).toEqual([]);
  });
});

describe('primera línea', () => {
  it('sólo la primera línea y recortada', () => {
    expect(primeraLinea('Título\n\ncuerpo largo')).toBe('Título');
    expect(primeraLinea('a'.repeat(200), 10)).toBe('aaaaaaaaa…');
  });
});
