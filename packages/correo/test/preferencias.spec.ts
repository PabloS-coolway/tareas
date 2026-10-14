import { describe, expect, it } from 'vitest';
import { componer, componerResumen, enZona, normalizarPreferencias, pasaPreferencias, preferenciasPorDefecto, tocaResumen, type CatalogoAvisos, type PreferenciasCorreo } from '../src';

const catalogo: CatalogoAvisos = [
  { clave: 'ASIGNADA', etiqueta: 'Te asignan', porDefecto: true },
  { clave: 'MENCION', etiqueta: 'Te mencionan', porDefecto: true },
  { clave: 'COMENTARIO', etiqueta: 'Comentan', porDefecto: false },
];
const NIVELES = 4; // Baja, Normal, Alta, Urgente
const base = preferenciasPorDefecto(catalogo);
const aviso = { tipo: 'ASIGNADA', ambitoId: 7, nivel: 1 };

describe('preferencias por defecto', () => {
  it('activado, los tipos «por defecto», todos los ámbitos y al momento', () => {
    expect(base).toEqual({ activo: true, tipos: ['ASIGNADA', 'MENCION'], ambitos: { modo: 'todos', ids: [] }, nivelMinimo: null, modo: 'inmediato' });
  });
});

describe('qué avisos pasan', () => {
  it('por defecto pasan los tipos activados y no los demás', () => {
    expect(pasaPreferencias(base, aviso)).toBe(true);
    expect(pasaPreferencias(base, { ...aviso, tipo: 'COMENTARIO' })).toBe(false);
  });
  it('el interruptor personal apagado no deja pasar nada', () => {
    expect(pasaPreferencias({ ...base, activo: false }, aviso)).toBe(false);
  });
  it('«solo estos» y «silenciar estos» ámbitos', () => {
    const solo: PreferenciasCorreo = { ...base, ambitos: { modo: 'solo', ids: [3] } };
    expect(pasaPreferencias(solo, aviso)).toBe(false);
    expect(pasaPreferencias(solo, { ...aviso, ambitoId: 3 })).toBe(true);
    const silenciar: PreferenciasCorreo = { ...base, ambitos: { modo: 'silenciar', ids: ['7'] } };
    expect(pasaPreferencias(silenciar, aviso)).toBe(false);
    expect(pasaPreferencias(silenciar, { ...aviso, ambitoId: 8 })).toBe(true);
    expect(pasaPreferencias(solo, { ...aviso, ambitoId: null })).toBe(true); // sin ámbito, el filtro no aplica
  });
  it('nivel mínimo', () => {
    const alta = { ...base, nivelMinimo: 2 };
    expect(pasaPreferencias(alta, { ...aviso, nivel: 0 })).toBe(false);
    expect(pasaPreferencias(alta, { ...aviso, nivel: 3 })).toBe(true);
    expect(pasaPreferencias(alta, { ...aviso, nivel: null })).toBe(true);
  });
});

describe('validación de lo que llega de la pantalla', () => {
  const ok = { activo: true, tipos: ['MENCION', 'ASIGNADA', 'MENCION'], ambitos: { modo: 'silenciar', ids: [7, 7] }, nivelMinimo: 2, modo: 'resumen' };
  it('limpia repetidos y respeta el orden del catálogo', () => {
    expect(normalizarPreferencias(ok, catalogo, NIVELES)).toEqual({ activo: true, tipos: ['ASIGNADA', 'MENCION'], ambitos: { modo: 'silenciar', ids: [7] }, nivelMinimo: 2, modo: 'resumen' });
  });
  it('«todos» no guarda ids', () => {
    expect(normalizarPreferencias({ ...ok, ambitos: { modo: 'todos', ids: [7] } }, catalogo, NIVELES).ambitos.ids).toEqual([]);
  });
  it('rechaza tipos desconocidos, modos raros, nivel fuera de escala y «solo» vacío', () => {
    expect(() => normalizarPreferencias({ ...ok, tipos: ['OTRO'] }, catalogo, NIVELES)).toThrow('desconocido');
    expect(() => normalizarPreferencias({ ...ok, modo: 'semanal' }, catalogo, NIVELES)).toThrow('al momento');
    expect(() => normalizarPreferencias({ ...ok, nivelMinimo: 4 }, catalogo, NIVELES)).toThrow('nivel');
    expect(() => normalizarPreferencias({ ...ok, ambitos: { modo: 'solo', ids: [] } }, catalogo, NIVELES)).toThrow('al menos uno');
    expect(() => normalizarPreferencias(null, catalogo, NIVELES)).toThrow();
  });
});

describe('cuándo toca el resumen', () => {
  const madrid = { zona: 'Europe/Madrid', hora: 8, dias: [1, 2, 3, 4, 5] };
  const t = (iso: string) => new Date(iso);
  it('día laborable: desde las 8:00 de Madrid, no antes (horario de verano, UTC+2)', () => {
    expect(tocaResumen(t('2026-10-14T05:59:00Z'), null, madrid)).toBe(false); // 7:59
    expect(tocaResumen(t('2026-10-14T06:00:00Z'), null, madrid)).toBe(true); // 8:00
    expect(tocaResumen(t('2026-10-14T15:00:00Z'), null, madrid)).toBe(true); // si estuvo parado, sale al volver
  });
  it('tras el cambio de hora del último domingo de octubre (UTC+1)', () => {
    expect(enZona(t('2026-10-26T06:59:00Z'), 'Europe/Madrid')).toEqual({ fecha: '2026-10-26', hora: 7, dia: 1 });
    expect(tocaResumen(t('2026-10-26T06:59:00Z'), null, madrid)).toBe(false); // lunes 7:59
    expect(tocaResumen(t('2026-10-26T07:00:00Z'), null, madrid)).toBe(true); // lunes 8:00
  });
  it('sábado y domingo no', () => {
    expect(tocaResumen(t('2026-10-17T09:00:00Z'), null, madrid)).toBe(false);
    expect(tocaResumen(t('2026-10-18T09:00:00Z'), null, madrid)).toBe(false);
  });
  it('uno al día: si ya salió hoy no; el de ayer no cuenta', () => {
    expect(tocaResumen(t('2026-10-14T06:05:00Z'), t('2026-10-14T06:00:30Z'), madrid)).toBe(false);
    expect(tocaResumen(t('2026-10-14T06:05:00Z'), t('2026-10-13T06:00:30Z'), madrid)).toBe(true);
  });
  it('otra zona horaria (Chile, UTC-3 en octubre)', () => {
    const santiago = { zona: 'America/Santiago', hora: 8, dias: [1, 2, 3, 4, 5] };
    expect(tocaResumen(t('2026-10-14T10:59:00Z'), null, santiago)).toBe(false);
    expect(tocaResumen(t('2026-10-14T11:00:00Z'), null, santiago)).toBe(true);
  });
});

describe('plantilla con enlaces y nota al pie', () => {
  const marca = { nombre: 'Tareas Acme', url: 'https://tareas.acme.test', pie: '' };
  it('sin esos campos el correo sale igual que antes', () => {
    const a = componer(marca, { titulo: 'Hola', parrafos: ['x'] });
    expect(a.html).not.toContain('<ul');
    expect(a.texto).toBe(['Hola', '', 'x', '', '—', 'Tareas Acme'].join('\n'));
  });
  it('el resumen lleva un enlace por aviso, escapado, y el enlace a las preferencias', () => {
    const r = componerResumen(marca, 'Ana', [{ texto: 'Luis te asignó WEB-12 · <Portada>', url: 'https://tareas.acme.test/t/WEB-12' }, { texto: 'Te mencionó en WEB-3', url: 'https://tareas.acme.test/t/WEB-3' }], 'https://tareas.acme.test/perfil');
    expect(r.asunto).toBe('Tienes 2 avisos sin leer');
    expect(r.html).toContain('href="https://tareas.acme.test/t/WEB-12"');
    expect(r.html).toContain('&lt;Portada&gt;');
    expect(r.html).toContain('href="https://tareas.acme.test/perfil"');
    expect(r.texto).toContain('- Te mencionó en WEB-3: https://tareas.acme.test/t/WEB-3');
    expect(r.texto).toContain('Cambia qué correos recibes: https://tareas.acme.test/perfil');
    expect(componerResumen(marca, 'Ana', [{ texto: 'a', url: 'u' }], 'p').asunto).toBe('Tienes 1 aviso sin leer');
  });
});
