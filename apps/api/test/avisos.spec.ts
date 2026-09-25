import { limpiarIdsAvisos, sinLeerPorProyecto } from '../src/tareas/domain/avisos';

describe('avisos sin leer por proyecto (el número rojo del menú)', () => {
  it('cuenta por clave de proyecto e ignora los avisos sin tarea', () => {
    expect(sinLeerPorProyecto(['SAAS', 'ATC', 'SAAS', null, undefined])).toEqual({ SAAS: 2, ATC: 1 });
  });

  it('sin avisos, nada', () => {
    expect(sinLeerPorProyecto([])).toEqual({});
  });
});

describe('ids de avisos a marcar leídos', () => {
  it('solo los que se han visto: enteros positivos sin repetidos', () => {
    expect(limpiarIdsAvisos([3, '3', 5, 0, -1, 'x', 2.5])).toEqual([3, 5]);
  });

  it('si no llega una lista, ninguno (nunca «todos»)', () => {
    expect(limpiarIdsAvisos(undefined)).toEqual([]);
    expect(limpiarIdsAvisos('1,2')).toEqual([]);
  });
});
