import { aplica, cambiosDeRegla, type EventoTarea, type Regla } from '../src/tareas/domain/reglas';

const evento = (x: Partial<EventoTarea> = {}): EventoTarea => ({ trigger: 'CREATED', statusKey: 'pendiente', type: 'INCIDENT', priority: 'URGENT', tags: [], assigneeId: null, followerIds: [], ...x });
const regla = (x: Partial<Regla> = {}): Regla => ({ id: 1, active: true, trigger: 'CREATED', conditions: {}, actions: {}, ...x });

describe('qué reglas saltan', () => {
  it('«incidencia urgente al crearse» salta con una incidencia urgente', () => {
    expect(aplica(regla({ conditions: { type: 'INCIDENT', priority: 'URGENT' } }), evento())).toBe(true);
  });
  it('no salta si alguna condición no se cumple', () => {
    expect(aplica(regla({ conditions: { type: 'INCIDENT', priority: 'URGENT' } }), evento({ priority: 'NORMAL' }))).toBe(false);
    expect(aplica(regla({ conditions: { tag: 'tienda' } }), evento({ tags: ['otra'] }))).toBe(false);
  });
  it('la etiqueta se compara sin mayúsculas', () => {
    expect(aplica(regla({ conditions: { tag: 'Tienda ' } }), evento({ tags: ['tienda'] }))).toBe(true);
  });
  it('una regla desactivada o de otro momento no salta', () => {
    expect(aplica(regla({ active: false }), evento())).toBe(false);
    expect(aplica(regla({ trigger: 'STATUS' }), evento())).toBe(false);
  });
  it('al pasar a un estado: sólo el estado indicado (o cualquiera si no se indica)', () => {
    const e = evento({ trigger: 'STATUS', statusKey: 'completado' });
    expect(aplica(regla({ trigger: 'STATUS', conditions: { statusKey: 'completado' } }), e)).toBe(true);
    expect(aplica(regla({ trigger: 'STATUS', conditions: { statusKey: 'en-curso' } }), e)).toBe(false);
    expect(aplica(regla({ trigger: 'STATUS' }), e)).toBe(true);
  });
});

describe('qué cambia una regla', () => {
  it('asigna sólo si la tarea no tiene responsable', () => {
    expect(cambiosDeRegla({ assigneeId: 7 }, evento())).toEqual({ assigneeId: 7 });
    expect(cambiosDeRegla({ assigneeId: 7 }, evento({ assigneeId: 3 }))).toBeNull();
  });
  it('con «reasignar» pisa al responsable', () => {
    expect(cambiosDeRegla({ assigneeId: 7, reassign: true }, evento({ assigneeId: 3 }))).toEqual({ assigneeId: 7 });
  });
  it('añade seguidores y etiquetas sin quitar las que había ni repetir', () => {
    expect(cambiosDeRegla({ addFollowerIds: [2, 5], addTags: ['Tienda', 'x'] }, evento({ followerIds: [2], tags: ['x'] }))).toEqual({ followerIds: [2, 5], tags: ['x', 'tienda'] });
  });
  it('si no cambia nada, no toca la tarea', () => {
    expect(cambiosDeRegla({ priority: 'URGENT', notifyUserIds: [1] }, evento())).toBeNull();
  });
});
