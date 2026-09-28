import { tituloIncidencia } from '../src/tareas/domain/incidencia';

describe('título de la incidencia del formulario', () => {
  it('sucursal con su número y la incidencia', () => {
    expect(tituloIncidencia('12', 'Se ha roto la TPV')).toBe('Sucursal 12 - Se ha roto la TPV');
  });
  it('no repite «Sucursal» si ya viene en la lista', () => {
    expect(tituloIncidencia('Sucursal 12 · Palermo', 'Sin luz')).toBe('Sucursal 12 · Palermo - Sin luz');
    expect(tituloIncidencia('SUCURSAL 9', 'Sin luz')).toBe('SUCURSAL 9 - Sin luz');
  });
});
