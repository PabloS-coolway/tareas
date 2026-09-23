import { interesados, limpiarSeguidores } from '../src/tareas/domain/interesados';

describe('quién se entera de una tarea', () => {
  it('los seguidores reciben los avisos además del responsable y de quien la creó', () => {
    expect(interesados({ assigneeId: 1, reporterId: 2, followerIds: [3, 4] })).toEqual([1, 2, 3, 4]);
  });

  it('sin responsable, siguen enterándose quien la creó y los seguidores', () => {
    expect(interesados({ assigneeId: null, reporterId: 2, followerIds: [3] })).toEqual([2, 3]);
  });

  it('quien es responsable y además sigue la tarea recibe un solo aviso', () => {
    expect(interesados({ assigneeId: 1, reporterId: 1, followerIds: [1, 3] })).toEqual([1, 3]);
  });
});

describe('lista de seguidores', () => {
  it('quita repetidos, basura y negativos', () => {
    expect(limpiarSeguidores([3, '3', 5, 0, -1, 'x', 2.5])).toEqual([3, 5]);
  });

  it('lo que no es una lista queda vacío', () => {
    expect(limpiarSeguidores(undefined)).toEqual([]);
    expect(limpiarSeguidores('3')).toEqual([]);
  });
});
