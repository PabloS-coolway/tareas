import { componerCorreoRegla, motivoParaNoEnviarRegla, TIPO_CORREO_REGLA } from '../src/tareas/domain/avisos-correo';
import { RulesService } from '../src/tareas/application/rules.service';

const marca = { nombre: 'Tareas Yorga', url: 'https://tareas-yorga-ewv2n.ondigitalocean.app', pie: '' };
const base = {
  regla: 'Incidencia urgente',
  disparador: 'CREATED' as const,
  estado: 'Pendiente',
  proyecto: 'Atención al Cliente',
  tarea: { clave: 'ATC-31', titulo: 'Sucursal Madrid sin datáfono', prioridad: 'URGENT' as const, responsable: null },
  destinatario: { nombre: 'Catalina', email: 'catalina@coolway.com' },
};

describe('correo de una regla', () => {
  it('al crear: título con la regla, prioridad, responsable, botón a la tarea y motivo al pie', () => {
    const m = componerCorreoRegla(base, marca);
    expect(m.para).toBe('catalina@coolway.com');
    expect(m.asunto).toBe('ATC-31 · Sucursal Madrid sin datáfono');
    expect(m.tipo).toBe(TIPO_CORREO_REGLA);
    expect(m.texto).toContain('Regla «Incidencia urgente»: se ha creado ATC-31');
    expect(m.texto).toContain('Prioridad: Urgente · Responsable: sin responsable');
    expect(m.html).toContain('href="https://tareas-yorga-ewv2n.ondigitalocean.app/t/ATC-31"');
    expect(m.texto).toContain('Te llega por la regla «Incidencia urgente» del proyecto Atención al Cliente');
  });
  it('al pasar a un estado, con responsable', () => {
    const m = componerCorreoRegla({ ...base, disparador: 'STATUS', estado: 'Bloqueada', tarea: { ...base.tarea, responsable: 'Robert' } }, marca);
    expect(m.texto).toContain('Regla «Incidencia urgente»: ATC-31 ha pasado a Bloqueada');
    expect(m.texto).toContain('Responsable: Robert');
  });
  it('escapa lo que viene de la regla y de la tarea', () => {
    const m = componerCorreoRegla({ ...base, regla: '<b>x</b>', tarea: { ...base.tarea, titulo: '<script>' } }, marca);
    expect(m.html).not.toContain('<script>');
    expect(m.html).not.toContain('<b>x</b>');
  });
});

describe('a quién se manda el correo de una regla', () => {
  const ok = { activo: true, email: 'catalina@coolway.com', interruptorPersonal: true, veProyecto: true };
  it('la regla manda sobre las preferencias: solo lo paran su interruptor, estar desactivada, sin correo o sin ver el proyecto', () => {
    expect(motivoParaNoEnviarRegla(ok)).toBeNull();
    expect(motivoParaNoEnviarRegla({ ...ok, interruptorPersonal: false })).toBe('tiene apagados los avisos por correo');
    expect(motivoParaNoEnviarRegla({ ...ok, activo: false })).toBe('persona desactivada');
    expect(motivoParaNoEnviarRegla({ ...ok, email: '' })).toBe('sin dirección de correo');
    expect(motivoParaNoEnviarRegla({ ...ok, veProyecto: false })).toBe('no ve el proyecto');
  });
});

describe('validación de la acción «Enviar correo a»', () => {
  const prisma = (activos: number) => ({
    project: { findUnique: async () => ({ id: 8, statuses: [] }) },
    user: { count: async () => activos },
    automationRule: { create: async (a: { data: Record<string, unknown> }) => ({ id: 1, ...a.data, runs: 0, lastRunAt: null, createdAt: new Date(), updatedAt: new Date(), createdById: 1, project: { key: 'ATC', name: 'Atención al Cliente' }, createdBy: { id: 1, name: 'PabloS', email: 'pablo.silva@coolway.com' } }) },
  });
  const dto = { projectId: 8, name: 'Incidencia urgente', trigger: 'CREATED' as const, conditions: { priority: 'URGENT' as const }, actions: { emailUserIds: [5, 5] } };
  it('vale como única acción y limpia repetidos', async () => {
    const r = await new RulesService(prisma(1) as never).create(dto, 1);
    expect(r.actions.emailUserIds).toEqual([5]);
  });
  it('una persona desactivada o que no existe no vale', async () => {
    await expect(new RulesService(prisma(0) as never).create(dto, 1)).rejects.toThrow('no es válida');
  });
});
