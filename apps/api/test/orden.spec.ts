import { HUECO_MINIMO, ordenPara, renumerar } from '../src/tareas/domain/orden';

describe('ordenPara (posición en la columna del tablero)', () => {
  it('columna vacía → 0', () => {
    expect(ordenPara([], 0)).toEqual({ order: 0, renumerar: false });
  });
  it('al principio → uno menos que la primera', () => {
    expect(ordenPara([5, 6, 7], 0)).toEqual({ order: 4, renumerar: false });
  });
  it('al final (o índice fuera de rango) → uno más que la última', () => {
    expect(ordenPara([5, 6, 7], 3)).toEqual({ order: 8, renumerar: false });
    expect(ordenPara([5, 6, 7], 99)).toEqual({ order: 8, renumerar: false });
  });
  it('en medio → punto medio entre vecinas', () => {
    expect(ordenPara([0, 1, 2], 1)).toEqual({ order: 0.5, renumerar: false });
  });
  it('pide renumerar cuando el hueco se agota', () => {
    const r = ordenPara([1, 1 + HUECO_MINIMO / 2], 1);
    expect(r.renumerar).toBe(true);
  });
});

describe('renumerar', () => {
  it('asigna 0..n en el orden dado', () => {
    expect(renumerar([9, 4, 7])).toEqual([
      { id: 9, order: 0 },
      { id: 4, order: 1 },
      { id: 7, order: 2 },
    ]);
  });
});
