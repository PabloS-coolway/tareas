import { describe, expect, it } from 'vitest';
import { escribirFiltros, filtrosActivos, hayFiltros, leerFiltros } from '../src/ui/filtros/filtros-url';

const DEF = { q: '', assignee: '', tag: '', vencidas: false };

describe('filtros en la URL', () => {
  it('los filtros puestos sobreviven al ir y volver: lo que se escribe es lo que se lee', () => {
    const puestos = { q: 'guía', assignee: 'me', tag: 'revisar-23-sep', vencidas: true };
    const url = escribirFiltros(puestos, DEF);
    expect(leerFiltros(new URLSearchParams(url.toString()), DEF)).toEqual(puestos);
  });

  it('sólo escribe los que no son el valor por defecto', () => {
    expect(escribirFiltros({ ...DEF, assignee: 'me' }, DEF).toString()).toBe('assignee=me');
    expect(escribirFiltros(DEF, DEF).toString()).toBe('');
  });

  it('conserva los parámetros que no son filtros', () => {
    expect(escribirFiltros({ ...DEF, tag: 'x' }, DEF, new URLSearchParams('otro=1')).toString()).toBe('otro=1&tag=x');
  });

  it('quitar un filtro lo borra de la URL', () => {
    expect(escribirFiltros({ ...DEF, assignee: 'me', tag: '' }, DEF, new URLSearchParams('tag=x&assignee=me')).toString()).toBe('assignee=me');
  });

  it('sin filtros en la URL se sabe que hay que recuperar los últimos', () => {
    expect(hayFiltros(new URLSearchParams(''), DEF)).toBe(false);
    expect(hayFiltros(new URLSearchParams('vencidas=1'), DEF)).toBe(true);
  });

  it('distingue si hay algún filtro activo', () => {
    expect(filtrosActivos(DEF, DEF)).toBe(false);
    expect(filtrosActivos({ ...DEF, vencidas: true }, DEF)).toBe(true);
  });
});
