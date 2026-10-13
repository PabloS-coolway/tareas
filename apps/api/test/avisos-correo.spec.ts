import { AVISOS_POR_CORREO, componerAviso, motivoParaNoEnviar, vaPorCorreo, type AvisoParaCorreo } from '../src/tareas/domain/avisos-correo';

const marca = { nombre: 'Tareas Yorga', url: 'https://tareas-yorga-ewv2n.ondigitalocean.app', pie: '' };
const aviso: AvisoParaCorreo = {
  tipo: 'ASSIGNED',
  texto: 'te asignó COOL-203 · Badges de descuento en cards y PDP',
  actor: 'David',
  destinatario: { email: 'catalina@coolway.com', nombre: 'Catalina', activo: true },
  tarea: { clave: 'COOL-203', titulo: 'Badges de descuento en cards y PDP', projectId: 4 },
};

describe('qué avisos van por correo', () => {
  it('solo asignación, mención y plazo', () => {
    expect(['ASSIGNED', 'MENTION', 'SLA'].every(vaPorCorreo)).toBe(true);
    expect(['COMMENT', 'STATUS', 'FOLLOW', 'RULE', 'BLOCKER_DONE', 'PASSWORD_RESET'].some(vaPorCorreo)).toBe(false);
    expect(motivoParaNoEnviar({ ...aviso, tipo: 'COMMENT' }, null)).toBe('este aviso no va por correo');
  });
  it('no a personas desactivadas, sin email o que no ven el proyecto', () => {
    expect(motivoParaNoEnviar(aviso, null)).toBeNull();
    expect(motivoParaNoEnviar(aviso, [4, 7])).toBeNull();
    expect(motivoParaNoEnviar({ ...aviso, destinatario: { ...aviso.destinatario, activo: false } }, null)).toBe('persona desactivada');
    expect(motivoParaNoEnviar({ ...aviso, destinatario: { ...aviso.destinatario, email: '' } }, null)).toBe('sin dirección de correo');
    expect(motivoParaNoEnviar(aviso, [7])).toBe('no ve el proyecto');
  });
});

describe('contenido del correo de un aviso', () => {
  it('asunto con clave y título, quién y qué, y botón a la tarea', () => {
    const m = componerAviso({ ...aviso, tipo: 'ASSIGNED' }, marca);
    expect(m.para).toBe('catalina@coolway.com');
    expect(m.asunto).toBe('COOL-203 · Badges de descuento en cards y PDP');
    expect(m.tipo).toBe(AVISOS_POR_CORREO.ASSIGNED);
    expect(m.texto).toContain('David te asignó COOL-203');
    expect(m.html).toContain('href="https://tareas-yorga-ewv2n.ondigitalocean.app/t/COOL-203"');
  });
  it('un plazo vencido (sin actor) empieza en mayúscula', () => {
    const m = componerAviso({ ...aviso, tipo: 'SLA', actor: null, texto: 'fuera de plazo: ATC-12 · Incidencia sucursal (urgente, 4 h sin empezar)' }, marca);
    expect(m.texto.startsWith('Fuera de plazo: ATC-12')).toBe(true);
    expect(m.tipo).toBe('aviso.plazo');
  });
});
