import { clavesEnTexto, primeraLinea } from '../src/tareas/domain/git';

const P = ['COOL', 'TAREAS', 'SASS-IA', 'INC'];

describe('claves de tarea en mensajes de git', () => {
  it('encuentra las claves de proyectos que existen', () => {
    expect(clavesEnTexto('Seguidores con avisos (TAREAS-6) y fix COOL-32', P)).toEqual(['TAREAS-6', 'COOL-32']);
  });
  it('proyectos con guion en la clave', () => {
    expect(clavesEnTexto('SASS-IA-12: multitenant', P)).toEqual(['SASS-IA-12']);
  });
  it('ignora lo que parece una clave pero no es de ningún proyecto', () => {
    expect(clavesEnTexto('sha-256, UTF-8, ISO-8601 y ABC-12', P)).toEqual([]);
  });
  it('no repite y normaliza ceros', () => {
    expect(clavesEnTexto('COOL-032 … otra vez COOL-32', P)).toEqual(['COOL-32']);
  });
  it('no confunde un trozo de otra palabra', () => {
    expect(clavesEnTexto('XCOOL-3 y COOL-3x', P)).toEqual([]);
  });
});

describe('primera línea', () => {
  it('sólo la primera línea y recortada', () => {
    expect(primeraLinea('Título\n\ncuerpo largo')).toBe('Título');
    expect(primeraLinea('a'.repeat(200), 10)).toBe('aaaaaaaaa…');
  });
});

import { nombreDeRama, resumenDesarrollo, type RefGit } from '../src/tareas/domain/git';

const ref = (x: Partial<RefGit>): RefGit => ({ kind: 'commit', ref: 'o/r@abc', url: 'u', title: 't', repo: 'o/r', branch: null, author: null, number: null, at: null, createdAt: new Date('2026-09-23T10:00:00Z'), ...x });

describe('panel Desarrollo', () => {
  it('commits del más reciente al más antiguo, con su rama', () => {
    const d = resumenDesarrollo([
      ref({ ref: 'o/r@aaa', title: 'viejo', at: new Date('2026-09-20T10:00:00Z'), branch: 'main' }),
      ref({ ref: 'o/r@bbb', title: 'nuevo', at: new Date('2026-09-22T10:00:00Z'), branch: 'feat/COOL-3-x' }),
    ]);
    expect(d.commits.map((c) => c.sha)).toEqual(['bbb', 'aaa']);
    expect(d.branches.map((b) => b.name)).toEqual(['feat/COOL-3-x', 'main']);
  });
  it('una PR abierta y luego mergeada sale una vez, como mergeada', () => {
    const d = resumenDesarrollo([
      ref({ kind: 'pr-opened', ref: 'o/r#7', number: 7, title: 'Guía', branch: 'feat/COOL-3-guia', at: new Date('2026-09-21T10:00:00Z') }),
      ref({ kind: 'pr-merged', ref: 'o/r#7', number: 7, title: 'Guía', branch: 'feat/COOL-3-guia', at: new Date('2026-09-22T10:00:00Z') }),
    ]);
    expect(d.pullRequests).toHaveLength(1);
    expect(d.pullRequests[0]).toMatchObject({ number: 7, state: 'merged' });
  });
  it('una rama guardada sola (por su nombre) aparece con su enlace', () => {
    const d = resumenDesarrollo([ref({ kind: 'branch', ref: 'o/r:feat/COOL-3-x', branch: 'feat/COOL-3-x' })]);
    expect(d.branches).toEqual([{ repo: 'o/r', name: 'feat/COOL-3-x', url: 'https://github.com/o/r/tree/feat/COOL-3-x' }]);
  });
});

describe('nombre de rama sugerido', () => {
  it('clave + título sin acentos ni símbolos, corto', () => {
    expect(nombreDeRama('COOL-32', 'FIX maquetación guía de tallas (iPhone)!')).toBe('feat/COOL-32-fix-maquetacion-guia-de-tallas-iphone');
    expect(nombreDeRama('TAREAS-9', 'Commits enlazados con tareas', 'fix')).toBe('fix/TAREAS-9-commits-enlazados-con-tareas');
  });
});
