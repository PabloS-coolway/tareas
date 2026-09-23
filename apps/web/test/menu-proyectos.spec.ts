import { describe, expect, it } from 'vitest';
import type { ProjectDto } from '@yorga/contracts';
import { proyectosDelMenu } from '../src/ui/layout/menu-proyectos';

const proyecto = (key: string, mineTotalCount: number): ProjectDto =>
  ({ id: key.length, key, name: key, description: '', color: '#000', archived: false, statuses: [], teamId: null, teamKey: null, teamName: null, openCount: 0, mineCount: 0, mineTotalCount, mineDoingCount: 0, doneCount: 0, createdAt: '2026-09-23T00:00:00.000Z' }) as ProjectDto;

const todos = [proyecto('COOL', 3), proyecto('ATC', 0), proyecto('ERP', 0), proyecto('SAAS', 1)];

describe('proyectos del menú', () => {
  it('sin el filtro se ven todos', () => {
    expect(proyectosDelMenu(todos, false).map((p) => p.key)).toEqual(['COOL', 'ATC', 'ERP', 'SAAS']);
  });

  it('con el filtro, solo los que tienen alguna tarea mía', () => {
    expect(proyectosDelMenu(todos, true).map((p) => p.key)).toEqual(['COOL', 'SAAS']);
  });

  it('el proyecto que estoy viendo no desaparece del menú aunque no tenga tareas mías', () => {
    expect(proyectosDelMenu(todos, true, 'ERP').map((p) => p.key)).toEqual(['COOL', 'ERP', 'SAAS']);
  });

  it('cuentan también mis tareas terminadas (mineTotalCount, no las abiertas)', () => {
    const soloTerminadas = [{ ...proyecto('INC', 2), mineCount: 0, openCount: 9 }];
    expect(proyectosDelMenu(soloTerminadas, true).map((p) => p.key)).toEqual(['INC']);
  });

  it('quien no tiene ninguna tarea asignada sigue viendo la lista completa', () => {
    const sinNada = todos.map((p) => ({ ...p, mineTotalCount: 0 }));
    expect(proyectosDelMenu(sinNada, true).map((p) => p.key)).toEqual(['COOL', 'ATC', 'ERP', 'SAAS']);
  });
});
