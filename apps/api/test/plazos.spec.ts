import { PLAZO_POR_DEFECTO, fueraDePlazo, horasDePlazo, limpiarPlazos } from '../src/tareas/domain/plazos';

const creada = new Date('2026-09-23T10:00:00Z');
const a = (h: number) => new Date(creada.getTime() + h * 3_600_000);

describe('plazo de respuesta', () => {
  it('por defecto: urgente 2 h, alta 8 h, normal 24 h, baja 72 h', () => {
    expect(PLAZO_POR_DEFECTO).toEqual({ URGENT: 2, HIGH: 8, NORMAL: 24, LOW: 72 });
  });
  it('una urgente sin empezar a las 2 h está fuera de plazo; a la 1 h no', () => {
    const t = { createdAt: creada, priority: 'URGENT' as const, category: 'TODO' as const };
    expect(fueraDePlazo(t, PLAZO_POR_DEFECTO, a(1))).toBe(false);
    expect(fueraDePlazo(t, PLAZO_POR_DEFECTO, a(2))).toBe(true);
  });
  it('en cuanto alguien la empieza (o se termina), el plazo está cumplido', () => {
    expect(fueraDePlazo({ createdAt: creada, priority: 'URGENT', category: 'DOING' }, PLAZO_POR_DEFECTO, a(50))).toBe(false);
    expect(fueraDePlazo({ createdAt: creada, priority: 'URGENT', category: 'DONE' }, PLAZO_POR_DEFECTO, a(50))).toBe(false);
  });
  it('sin plazos en el proyecto, nunca está fuera de plazo', () => {
    expect(fueraDePlazo({ createdAt: creada, priority: 'URGENT', category: 'TODO' }, null, a(500))).toBe(false);
    expect(horasDePlazo({ URGENT: 2 }, 'LOW')).toBeNull();
  });
  it('limpia lo que llega de la pantalla', () => {
    expect(limpiarPlazos({ URGENT: '2', HIGH: 0, NORMAL: -3, LOW: 99999, OTRA: 5 })).toEqual({ URGENT: 2, LOW: 720 });
    expect(limpiarPlazos({})).toBeNull();
  });
});
