import { describe, expect, it } from 'vitest';
import { destinoDirecto } from '../src/domain/ir-a';

const ORIGEN = 'https://tareas-yorga-ewv2n.ondigitalocean.app';
const ir = (t: string) => destinoDirecto(t, ORIGEN)?.to ?? null;

describe('ir directo desde el buscador (PWA sin barra de direcciones)', () => {
  it('una clave de tarea, en mayúsculas o minúsculas', () => {
    expect(ir('COOL-111')).toBe('/t/COOL-111');
    expect(ir('  cool-111 ')).toBe('/t/COOL-111');
    expect(ir('atencion-al-cliente-3')).toBe('/t/ATENCION-AL-CLIENTE-3');
  });

  it('el enlace de una tarea, aunque sea de otro entorno', () => {
    expect(ir(`${ORIGEN}/t/COOL-111`)).toBe('/t/COOL-111');
    expect(ir('http://localhost:5174/t/cool-12?x=1')).toBe('/t/COOL-12');
  });

  it('cualquier enlace de esta app, con su filtro', () => {
    expect(ir(`${ORIGEN}/p/COOL?sprint=5`)).toBe('/p/COOL?sprint=5');
    expect(ir('/sprints/3')).toBe('/sprints/3');
  });

  it('el texto normal y los enlaces de fuera siguen siendo búsqueda', () => {
    expect(ir('badges de descuento')).toBeNull();
    expect(ir('COOL')).toBeNull();
    expect(ir('https://github.com/PabloS-coolway/tareas')).toBeNull();
    expect(ir('')).toBeNull();
  });
});
