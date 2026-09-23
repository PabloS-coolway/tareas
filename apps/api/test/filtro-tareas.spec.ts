import { parseFilter } from '../src/tareas/interface/http/tasks.controller';

describe('filtros de GET /tasks', () => {
  it('«sigo yo» llega al servicio (si no se copia, devuelve todas las tareas)', () => {
    expect(parseFilter({ followedBy: 'me' }).followedBy).toBe('me');
    expect(parseFilter({ followedBy: '7' }).followedBy).toBe(7);
    expect(parseFilter({}).followedBy).toBeUndefined();
  });

  it('el rango del calendario llega al servicio', () => {
    expect(parseFilter({ dueFrom: '2026-09-01', dueTo: '2026-09-30' })).toMatchObject({ dueFrom: '2026-09-01', dueTo: '2026-09-30' });
  });
});
