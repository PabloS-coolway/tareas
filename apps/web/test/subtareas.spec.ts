import { describe, expect, it } from 'vitest';
import { estaBloqueada, moverEnLista, ordenarSubtareas, resumirSubtareas } from '../src/domain/subtareas';

const t = (id: string, key: string, category: string, blockedByOpenCount = 0) => ({ id, status: { key, category }, blockedByOpenCount });

describe('subtareas de una épica', () => {
  it('cuenta como bloqueada la que está en estado «bloqueada» (SAAS-84 salía como pendiente)', () => {
    expect(estaBloqueada(t('a', 'bloqueada', 'DOING'))).toBe(true);
    expect(estaBloqueada(t('a', 'blocked', 'DOING'))).toBe(true);
  });

  it('cuenta como bloqueada la que espera a otra tarea sin terminar', () => {
    expect(estaBloqueada(t('a', 'pendiente', 'TODO', 1))).toBe(true);
  });

  it('una hecha o una normal no están bloqueadas', () => {
    expect(estaBloqueada(t('a', 'completado', 'DONE', 1))).toBe(false);
    expect(estaBloqueada(t('a', 'en-curso', 'DOING'))).toBe(false);
  });

  it('resume hechas y bloqueadas', () => {
    const items = [t('a', 'completado', 'DONE'), t('b', 'bloqueada', 'DOING'), t('c', 'pendiente', 'TODO', 2), t('d', 'pendiente', 'TODO')];
    expect(resumirSubtareas(items)).toEqual({ total: 4, hechas: 1, bloqueadas: 2 });
  });

  it('pone las bloqueadas primero y las hechas al final, sin desordenar el resto', () => {
    const items = [t('a', 'completado', 'DONE'), t('b', 'pendiente', 'TODO'), t('c', 'bloqueada', 'DOING'), t('d', 'en-curso', 'DOING'), t('e', 'pendiente', 'TODO', 1)];
    expect(ordenarSubtareas(items).map((x) => x.id)).toEqual(['c', 'e', 'b', 'd', 'a']);
  });

  it('si están ordenadas a mano, respeta ese orden aunque haya bloqueadas o hechas', () => {
    const items = [{ ...t('a', 'completado', 'DONE'), subOrder: 0 }, { ...t('b', 'pendiente', 'TODO'), subOrder: 1 }, { ...t('c', 'bloqueada', 'DOING'), subOrder: null }];
    expect(ordenarSubtareas(items).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('mueve un elemento de una posición a otra', () => {
    expect(moverEnLista(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moverEnLista(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moverEnLista(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});
