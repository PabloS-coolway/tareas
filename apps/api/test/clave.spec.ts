import { claveTarea, esClaveProyectoValida, parsearClaveTarea, proponerClave } from '../src/tareas/domain/clave';

describe('claves de proyecto', () => {
  it('acepta 2-8 alfanuméricos empezando por letra', () => {
    expect(esClaveProyectoValida('COOL')).toBe(true);
    expect(esClaveProyectoValida('A1')).toBe(true);
    expect(esClaveProyectoValida('1A')).toBe(false);
    expect(esClaveProyectoValida('C')).toBe(false);
    expect(esClaveProyectoValida('DEMASIADO')).toBe(false);
  });
  it('propone claves legibles y no repetidas', () => {
    expect(proponerClave('Coolway')).toBe('COOL');
    expect(proponerClave('Atención al Cliente')).toBe('AC');
    expect(proponerClave('sass-ia')).toBe('SI');
    expect(proponerClave('Coolway', new Set(['COOL']))).toBe('COOL2');
  });
});

describe('claves de tarea', () => {
  it('compone y parsea COOL-12', () => {
    expect(claveTarea('COOL', 12)).toBe('COOL-12');
    expect(parsearClaveTarea('cool-12')).toEqual({ projectKey: 'COOL', number: 12 });
    expect(parsearClaveTarea('12')).toBeNull();
    expect(parsearClaveTarea('COOL-')).toBeNull();
  });
});
