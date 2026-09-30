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

import { etiquetaFormulario, MAX_IMAGEN_BYTES, problemaConImagenes, TEXTOS_FORMULARIO, tipoFormulario } from '../src/tareas/domain/incidencia';

describe('tipos de formulario', () => {
  it('sucursal por defecto; aplicación con sus propios textos', () => {
    expect(tipoFormulario(undefined)).toBe('sucursal');
    expect(tipoFormulario('inventado')).toBe('sucursal');
    expect(tipoFormulario('aplicacion')).toBe('aplicacion');
    expect(TEXTOS_FORMULARIO.aplicacion.urgencias.URGENT).not.toContain('vender');
  });
  it('la etiqueta propia manda; vacía, la del tipo', () => {
    expect(etiquetaFormulario('aplicacion', null)).toBe('Instancia');
    expect(etiquetaFormulario('aplicacion', '  Marca  ')).toBe('Marca');
    expect(etiquetaFormulario('sucursal', '')).toBe('Sucursal');
  });
  it('en aplicación el título por defecto no dice «Sucursal»', () => {
    expect(tituloIncidencia(TEXTOS_FORMULARIO.aplicacion.titulo, { ...datos, sucursal: 'Coolway EU', asunto: 'No carga Meta' })).toBe('Coolway EU - No carga Meta');
  });
});

describe('imágenes del formulario', () => {
  const png = { originalname: 'captura.png', mimetype: 'image/png', size: 200_000 };
  it('capturas normales valen', () => {
    expect(problemaConImagenes([])).toBeNull();
    expect(problemaConImagenes([png, { ...png, mimetype: 'image/jpeg' }])).toBeNull();
  });
  it('más de 5, no imágenes o demasiado grandes: se dice cuál', () => {
    expect(problemaConImagenes(Array(6).fill(png))).toContain('5');
    expect(problemaConImagenes([{ ...png, originalname: 'virus.exe', mimetype: 'application/octet-stream' }])).toContain('virus.exe');
    expect(problemaConImagenes([{ ...png, size: MAX_IMAGEN_BYTES + 1 }])).toContain('10 MB');
  });
});
