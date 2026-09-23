import { describe, expect, it } from 'vitest';
import { barra, lunesDe, rejillaMes, sumarMeses } from '../src/ui/calendario/fechas';

describe('calendario', () => {
  it('la semana empieza en lunes', () => {
    expect(lunesDe('2026-09-23')).toBe('2026-09-21'); // miércoles → lunes
    expect(lunesDe('2026-09-27')).toBe('2026-09-21'); // domingo → lunes de esa semana
    expect(lunesDe('2026-09-21')).toBe('2026-09-21');
  });

  it('la rejilla de septiembre 2026 cubre el mes en semanas completas', () => {
    const r = rejillaMes('2026-09');
    expect(r[0][0]).toBe('2026-08-31'); // el 1 de sept. es martes
    expect(r[r.length - 1][6]).toBe('2026-10-04');
    expect(r.every((s) => s.length === 7)).toBe(true);
    expect(r.flat()).toContain('2026-09-30');
  });

  it('cambiar de mes cruza el año', () => {
    expect(sumarMeses('2026-12', 1)).toBe('2027-01');
    expect(sumarMeses('2026-01', -1)).toBe('2025-12');
  });
});

describe('cronograma', () => {
  const desde = '2026-09-21';
  it('una tarea con inicio y vencimiento dentro de la ventana', () => {
    expect(barra({ startDate: '2026-09-22', dueDate: '2026-09-24' }, desde, 28)).toEqual({ inicio: 1, largo: 3, cortadaIzq: false, cortadaDer: false });
  });
  it('sin inicio es de un día', () => {
    expect(barra({ startDate: null, dueDate: '2026-09-23' }, desde, 28)).toMatchObject({ inicio: 2, largo: 1 });
  });
  it('se recorta por los bordes y avisa de ello', () => {
    expect(barra({ startDate: '2026-09-01', dueDate: '2026-09-22' }, desde, 28)).toEqual({ inicio: 0, largo: 2, cortadaIzq: true, cortadaDer: false });
    expect(barra({ startDate: '2026-10-15', dueDate: '2026-11-30' }, desde, 28)).toMatchObject({ inicio: 24, largo: 4, cortadaDer: true });
  });
  it('fuera de la ventana o sin vencimiento no se pinta', () => {
    expect(barra({ startDate: null, dueDate: '2026-09-01' }, desde, 28)).toBeNull();
    expect(barra({ startDate: null, dueDate: null }, desde, 28)).toBeNull();
  });
});
