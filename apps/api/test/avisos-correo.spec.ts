import { pasaPreferencias, preferenciasPorDefecto } from '@modulos/correo';
import { avisoFiltrable, CATALOGO_AVISOS, componerAviso, motivoParaNoEnviar, nivelDePrioridad, TIPO_EN_COLA, vaPorCorreo, type AvisoParaCorreo } from '../src/tareas/domain/avisos-correo';

const marca = { nombre: 'Tareas Yorga', url: 'https://tareas-yorga-ewv2n.ondigitalocean.app', pie: '' };
const aviso: AvisoParaCorreo = {
  tipo: 'ASSIGNED',
  texto: 'te asignó COOL-203 · Badges de descuento en cards y PDP',
  actor: 'David',
  destinatario: { email: 'catalina@coolway.com', nombre: 'Catalina', activo: true },
  tarea: { clave: 'COOL-203', titulo: 'Badges de descuento en cards y PDP', projectId: 4, prioridad: 'NORMAL' },
};

describe('qué avisos pueden ir por correo', () => {
  it('cualquier aviso de tarea; no el de restablecer contraseña (es para admins)', () => {
    expect(['ASSIGNED', 'MENTION', 'SLA', 'RULE', 'COMMENT', 'STATUS', 'FOLLOW', 'BLOCKER_DONE'].every(vaPorCorreo)).toBe(true);
    expect(vaPorCorreo('PASSWORD_RESET')).toBe(false);
    expect(CATALOGO_AVISOS.map((t) => t.clave).sort()).toEqual(Object.keys(TIPO_EN_COLA).sort());
  });
  it('sin tocar nada, solo asignación, mención y plazo (lo de antes de las preferencias)', () => {
    const def = preferenciasPorDefecto(CATALOGO_AVISOS);
    expect(def.tipos).toEqual(['ASSIGNED', 'MENTION', 'SLA']);
    expect(pasaPreferencias(def, avisoFiltrable(aviso))).toBe(true);
    expect(pasaPreferencias(def, avisoFiltrable({ ...aviso, tipo: 'COMMENT' }))).toBe(false);
  });
  it('no a personas desactivadas, sin email o que no ven el proyecto', () => {
    expect(motivoParaNoEnviar(aviso, null)).toBeNull();
    expect(motivoParaNoEnviar(aviso, [4, 7])).toBeNull();
    expect(motivoParaNoEnviar({ ...aviso, tipo: 'PASSWORD_RESET' }, null)).toBe('este aviso no va por correo');
    expect(motivoParaNoEnviar({ ...aviso, destinatario: { ...aviso.destinatario, activo: false } }, null)).toBe('persona desactivada');
    expect(motivoParaNoEnviar({ ...aviso, destinatario: { ...aviso.destinatario, email: '' } }, null)).toBe('sin dirección de correo');
    expect(motivoParaNoEnviar(aviso, [7])).toBe('no ve el proyecto');
  });
});

describe('traducción al módulo de preferencias', () => {
  it('el proyecto es el ámbito y la prioridad el nivel (Baja < Normal < Alta < Urgente)', () => {
    expect(avisoFiltrable(aviso)).toEqual({ tipo: 'ASSIGNED', ambitoId: 4, nivel: 1 });
    expect(nivelDePrioridad('LOW')).toBe(0);
    expect(nivelDePrioridad('URGENT')).toBe(3);
    expect(avisoFiltrable({ ...aviso, tarea: null })).toEqual({ tipo: 'ASSIGNED', ambitoId: null, nivel: null });
  });
  it('prioridad mínima Alta: una Normal no pasa y una Urgente sí', () => {
    const alta = { ...preferenciasPorDefecto(CATALOGO_AVISOS), nivelMinimo: nivelDePrioridad('HIGH') };
    expect(pasaPreferencias(alta, avisoFiltrable(aviso))).toBe(false);
    expect(pasaPreferencias(alta, avisoFiltrable({ ...aviso, tarea: { ...aviso.tarea!, prioridad: 'URGENT' } }))).toBe(true);
  });
});

describe('contenido del correo de un aviso', () => {
  it('asunto con clave y título, quién y qué, botón a la tarea y enlace a Mi perfil', () => {
    const m = componerAviso(aviso, marca);
    expect(m.para).toBe('catalina@coolway.com');
    expect(m.asunto).toBe('COOL-203 · Badges de descuento en cards y PDP');
    expect(m.tipo).toBe('aviso.asignada');
    expect(m.texto).toContain('David te asignó COOL-203');
    expect(m.html).toContain('href="https://tareas-yorga-ewv2n.ondigitalocean.app/t/COOL-203"');
    expect(m.html).toContain('href="https://tareas-yorga-ewv2n.ondigitalocean.app/perfil"');
    expect(m.texto).toContain('Cambia qué correos recibes: https://tareas-yorga-ewv2n.ondigitalocean.app/perfil');
  });
  it('un plazo vencido (sin actor) empieza en mayúscula; un comentario usa su tipo en la cola', () => {
    expect(componerAviso({ ...aviso, tipo: 'SLA', actor: null, texto: 'fuera de plazo: ATC-12 · Incidencia sucursal' }, marca).texto.startsWith('Fuera de plazo: ATC-12')).toBe(true);
    expect(componerAviso({ ...aviso, tipo: 'COMMENT' }, marca).tipo).toBe('aviso.comentario');
  });
});
