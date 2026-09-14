import { claveTarea, esClaveProyectoValida, normalizarClaveProyecto, parsearClaveTarea, proponerClave } from '../src/tareas/domain/clave';

describe('claves de proyecto', () => {
  it('acepta 2-24 alfanuméricos con guiones, empezando por letra', () => {
    expect(esClaveProyectoValida('COOLWAY')).toBe(true);
    expect(esClaveProyectoValida('SASS-IA')).toBe(true);
    expect(esClaveProyectoValida('ATENCION-AL-CLIENTE')).toBe(true);
    expect(esClaveProyectoValida('A1')).toBe(true);
    expect(esClaveProyectoValida('1A')).toBe(false);
    expect(esClaveProyectoValida('C')).toBe(false);
    expect(esClaveProyectoValida('COOL-')).toBe(false);
    expect(esClaveProyectoValida('-COOL')).toBe(false);
    expect(esClaveProyectoValida('UNA-CLAVE-DEMASIADO-LARGA-XX')).toBe(false);
  });
  it('normaliza nombres a clave', () => {
    expect(normalizarClaveProyecto('Atención al Cliente')).toBe('ATENCION-AL-CLIENTE');
    expect(normalizarClaveProyecto('sass-ia')).toBe('SASS-IA');
    expect(normalizarClaveProyecto('  Coolway  ')).toBe('COOLWAY');
  });
  it('propone claves cortas y no repetidas', () => {
    expect(proponerClave('Coolway')).toBe('COOL');
    expect(proponerClave('Atención al Cliente')).toBe('AC');
    expect(proponerClave('sass-ia')).toBe('SI');
    expect(proponerClave('Coolway', new Set(['COOL']))).toBe('COOL2');
  });
});

describe('claves de tarea', () => {
  it('compone y parsea COOL-12 y SASS-IA-3', () => {
    expect(claveTarea('COOL', 12)).toBe('COOL-12');
    expect(parsearClaveTarea('cool-12')).toEqual({ projectKey: 'COOL', number: 12 });
    expect(parsearClaveTarea('SASS-IA-3')).toEqual({ projectKey: 'SASS-IA', number: 3 });
    expect(parsearClaveTarea('12')).toBeNull();
    expect(parsearClaveTarea('COOL-')).toBeNull();
  });
});
