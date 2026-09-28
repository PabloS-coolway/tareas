import { limpiarPlantilla, PLANTILLA_TITULO, tituloIncidencia } from '../src/tareas/domain/incidencia';

const datos = { sucursal: '12', asunto: 'Se ha roto la TPV', nombre: 'Ana', urgencia: 'Urgente' };

describe('título de la incidencia del formulario', () => {
  it('por defecto: sucursal con su número y la incidencia', () => {
    expect(tituloIncidencia(PLANTILLA_TITULO, datos)).toBe('Sucursal 12 - Se ha roto la TPV');
  });
  it('no repite «Sucursal» si ya viene en la lista', () => {
    expect(tituloIncidencia(PLANTILLA_TITULO, { ...datos, sucursal: 'Sucursal 12 · Palermo' })).toBe('Sucursal 12 · Palermo - Se ha roto la TPV');
    expect(tituloIncidencia(PLANTILLA_TITULO, { ...datos, sucursal: 'SUCURSAL 9' })).toBe('SUCURSAL 9 - Se ha roto la TPV');
  });
  it('cada proyecto puede poner la suya', () => {
    expect(tituloIncidencia('[{urgencia}] Tienda {sucursal}: {asunto} ({nombre})', datos)).toBe('[Urgente] Tienda 12: Se ha roto la TPV (Ana)');
    expect(tituloIncidencia('{asunto} {otro}', datos)).toBe('Se ha roto la TPV {otro}');
  });
  it('la plantilla vacía vuelve a la de por defecto y sin {asunto} no vale', () => {
    expect(limpiarPlantilla('  ')).toBe(PLANTILLA_TITULO);
    expect(limpiarPlantilla(null)).toBe(PLANTILLA_TITULO);
    expect(() => limpiarPlantilla('Sucursal {sucursal}')).toThrow('{asunto}');
  });
});
