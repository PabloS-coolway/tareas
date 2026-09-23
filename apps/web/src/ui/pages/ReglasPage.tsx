import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal } from 'react-bootstrap';
import { Lightning, Pencil, Plus, Trash } from 'react-bootstrap-icons';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  RULE_TRIGGERS,
  RULE_TRIGGER_LABELS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type Priority,
  type ProjectDto,
  type RuleDto,
  type TaskType,
  type UpsertRuleDto,
  type UserRefDto,
} from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { useProyectos } from '../proyectos/ProyectosContext';
import { hace } from '../components/tareas-ui';

/** Reglas automáticas por proyecto: «cuando pasa X (y se cumple Y) → hacer Z». */
export function ReglasPage() {
  const { hasFeature } = useAuth();
  const puede = hasFeature('proyectos.gestionar');
  const { proyectos } = useProyectos();
  const [reglas, setReglas] = useState<RuleDto[] | null>(null);
  const [equipo, setEquipo] = useState<UserRefDto[]>([]);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<RuleDto | 'nueva' | null>(null);

  const cargar = () => tareasGateway.reglas().then(setReglas).catch((e) => setError((e as Error).message));
  useEffect(() => {
    void cargar();
    tareasGateway.directorio().then(setEquipo).catch(() => setEquipo([]));
  }, []);

  const nombre = useMemo(() => new Map(equipo.map((u) => [u.id, u.name])), [equipo]);
  const personas = (ids?: number[]) => (ids ?? []).map((i) => nombre.get(i) ?? `#${i}`).join(', ');
  const porProyecto = useMemo(() => {
    const m = new Map<number, RuleDto[]>();
    for (const r of reglas ?? []) m.set(r.projectId, [...(m.get(r.projectId) ?? []), r]);
    return m;
  }, [reglas]);

  async function alternar(r: RuleDto) {
    try {
      await tareasGateway.guardarRegla({ projectId: r.projectId, name: r.name, trigger: r.trigger, conditions: r.conditions, actions: r.actions, active: !r.active }, r.id);
      void cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function borrar(r: RuleDto) {
    if (!confirm(`¿Borrar la regla «${r.name}»?`)) return;
    try {
      await tareasGateway.borrarRegla(r.id);
      void cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const describir = (r: RuleDto) => {
    const p = proyectos.find((x) => x.id === r.projectId);
    const c = r.conditions;
    const cuando = [
      r.trigger === 'CREATED' ? 'se crea una tarea' : c.statusKey ? `una tarea pasa a «${p?.statuses.find((s) => s.key === c.statusKey)?.name ?? c.statusKey}»` : 'una tarea cambia de estado',
      c.type && `de tipo ${TASK_TYPE_LABELS[c.type].toLowerCase()}`,
      c.priority && `con prioridad ${PRIORITY_LABELS[c.priority].toLowerCase()}`,
      c.tag && `con la etiqueta «${c.tag}»`,
    ].filter(Boolean).join(' ');
    const a = r.actions;
    const hacer = [
      a.assigneeId && `asignar a ${nombre.get(a.assigneeId) ?? '…'}${a.reassign ? ' (aunque tenga responsable)' : ' (si no tiene)'}`,
      a.addFollowerIds?.length && `añadir al seguimiento a ${personas(a.addFollowerIds)}`,
      a.priority && `poner prioridad ${PRIORITY_LABELS[a.priority].toLowerCase()}`,
      a.addTags?.length && `etiquetar ${a.addTags.map((t) => `«${t}»`).join(', ')}`,
      a.notifyUserIds?.length && `avisar a ${personas(a.notifyUserIds)}`,
    ].filter(Boolean).join(' · ');
    return { cuando, hacer };
  };

  return (
    <div className="page">
      <header className="page-head mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-1">Reglas automáticas</h1>
          <p className="text-secondary mb-0">Cuando pasa algo en un proyecto, la app hace el resto: asignar, avisar, etiquetar… Todo queda en el historial de la tarea.</p>
        </div>
        {puede && <Button className="btn-brand" size="sm" onClick={() => setEditando('nueva')}><Plus /> Nueva regla</Button>}
      </header>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}

      {reglas && reglas.length === 0 && <Card><Card.Body className="text-secondary">Todavía no hay reglas. Ejemplo: «si entra una incidencia urgente, asignarla a Robert y avisar a Pablo».</Card.Body></Card>}

      {proyectos.filter((p) => porProyecto.has(p.id)).map((p) => (
        <Card key={p.id} className="mb-3">
          <Card.Body>
            <h2 className="h6 d-flex align-items-center gap-2 mb-3"><span className="nav-proj-dot" style={{ background: p.color }} />{p.name}</h2>
            {porProyecto.get(p.id)!.map((r) => {
              const { cuando, hacer } = describir(r);
              return (
                <div key={r.id} className={`regla ${r.active ? '' : 'apagada'}`}>
                  <Lightning className="regla-ico" />
                  <div className="flex-grow-1 min-w-0">
                    <div className="fw-semibold">{r.name} {!r.active && <Badge bg="secondary">pausada</Badge>}</div>
                    <div className="small"><span className="text-secondary">Cuando</span> {cuando} <span className="text-secondary">→</span> {hacer}</div>
                    <div className="small text-secondary">{r.runs ? `Ha saltado ${r.runs} ${r.runs === 1 ? 'vez' : 'veces'}, la última ${hace(r.lastRunAt!)}` : 'Aún no ha saltado'}</div>
                  </div>
                  {puede && (
                    <div className="d-flex align-items-center gap-2">
                      <Form.Check type="switch" id={`r-${r.id}`} checked={r.active} onChange={() => void alternar(r)} title={r.active ? 'Pausar' : 'Activar'} />
                      <Button size="sm" variant="link" className="p-0" onClick={() => setEditando(r)} title="Editar"><Pencil /></Button>
                      <Button size="sm" variant="link" className="p-0 text-danger" onClick={() => void borrar(r)} title="Borrar"><Trash /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </Card.Body>
        </Card>
      ))}

      {editando && (
        <ReglaModal
          regla={editando === 'nueva' ? null : editando}
          proyectos={proyectos}
          equipo={equipo}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            void cargar();
          }}
        />
      )}
    </div>
  );
}

function Personas({ id, valor, equipo, cambiar }: { id: string; valor: number[]; equipo: UserRefDto[]; cambiar: (v: number[]) => void }) {
  return (
    <div className="d-flex flex-wrap gap-1 align-items-center">
      {valor.map((u) => (
        <Badge key={u} bg="light" text="dark" className="border">
          {equipo.find((x) => x.id === u)?.name ?? u}{' '}
          <button type="button" className="btn btn-link btn-sm p-0 text-secondary" onClick={() => cambiar(valor.filter((x) => x !== u))} aria-label="Quitar">×</button>
        </Badge>
      ))}
      <Form.Select id={id} size="sm" value="" onChange={(e) => e.target.value && cambiar([...valor, Number(e.target.value)])} style={{ maxWidth: 200 }}>
        <option value="">Añadir…</option>
        {equipo.filter((u) => !valor.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </Form.Select>
    </div>
  );
}

function ReglaModal({ regla, proyectos, equipo, onClose, onSaved }: { regla: RuleDto | null; proyectos: ProjectDto[]; equipo: UserRefDto[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<UpsertRuleDto>(() =>
    regla
      ? { projectId: regla.projectId, name: regla.name, active: regla.active, trigger: regla.trigger, conditions: { ...regla.conditions }, actions: { ...regla.actions } }
      : { projectId: proyectos[0]?.id ?? 0, name: '', trigger: 'CREATED', conditions: {}, actions: {} },
  );
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const proyecto = proyectos.find((p) => p.id === f.projectId);
  const c = f.conditions ?? {};
  const a = f.actions;
  const setC = (x: Partial<typeof c>) => setF({ ...f, conditions: { ...c, ...x } });
  const setA = (x: Partial<typeof a>) => setF({ ...f, actions: { ...a, ...x } });

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      await tareasGateway.guardarRegla(f, regla?.id);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal show onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title className="h5">{regla ? 'Editar regla' : 'Nueva regla'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">⚠ {error}</Alert>}
        <div className="row g-3">
          <Form.Group className="col-md-7" controlId="rg-name">
            <Form.Label>Nombre</Form.Label>
            <Form.Control value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="p. ej. Incidencias urgentes → Robert" autoFocus />
          </Form.Group>
          <Form.Group className="col-md-5" controlId="rg-project">
            <Form.Label>Proyecto</Form.Label>
            <Form.Select value={f.projectId} onChange={(e) => setF({ ...f, projectId: Number(e.target.value), conditions: { ...c, statusKey: undefined } })} disabled={!!regla}>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Form.Select>
          </Form.Group>

          <div className="col-12"><div className="regla-seccion">Cuando</div></div>
          <Form.Group className="col-md-6" controlId="rg-trigger">
            <Form.Label>Momento</Form.Label>
            <Form.Select value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value as UpsertRuleDto['trigger'], conditions: { ...c, statusKey: undefined } })}>
              {RULE_TRIGGERS.map((t) => <option key={t} value={t}>{RULE_TRIGGER_LABELS[t]}</option>)}
            </Form.Select>
          </Form.Group>
          {f.trigger === 'STATUS' && (
            <Form.Group className="col-md-6" controlId="rg-status">
              <Form.Label>Estado</Form.Label>
              <Form.Select value={c.statusKey ?? ''} onChange={(e) => setC({ statusKey: e.target.value || undefined })}>
                <option value="">Cualquier cambio de estado</option>
                {proyecto?.statuses.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
              </Form.Select>
            </Form.Group>
          )}
          <Form.Group className="col-md-4" controlId="rg-type">
            <Form.Label>Si es de tipo</Form.Label>
            <Form.Select value={c.type ?? ''} onChange={(e) => setC({ type: (e.target.value as TaskType) || undefined })}>
              <option value="">Cualquiera</option>
              {TASK_TYPES.map((t) => <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group className="col-md-4" controlId="rg-prio">
            <Form.Label>Con prioridad</Form.Label>
            <Form.Select value={c.priority ?? ''} onChange={(e) => setC({ priority: (e.target.value as Priority) || undefined })}>
              <option value="">Cualquiera</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group className="col-md-4" controlId="rg-tag">
            <Form.Label>Con la etiqueta</Form.Label>
            <Form.Control value={c.tag ?? ''} onChange={(e) => setC({ tag: e.target.value || undefined })} placeholder="(cualquiera)" />
          </Form.Group>

          <div className="col-12"><div className="regla-seccion">Entonces</div></div>
          <Form.Group className="col-md-6" controlId="rg-assignee">
            <Form.Label>Asignar a</Form.Label>
            <Form.Select value={a.assigneeId ?? ''} onChange={(e) => setA({ assigneeId: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">No cambiar</option>
              {equipo.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Form.Select>
            {a.assigneeId && <Form.Check className="mt-1 small" id="rg-reassign" label="Aunque ya tenga responsable" checked={!!a.reassign} onChange={(e) => setA({ reassign: e.target.checked || undefined })} />}
          </Form.Group>
          <Form.Group className="col-md-6" controlId="rg-setprio">
            <Form.Label>Poner prioridad</Form.Label>
            <Form.Select value={a.priority ?? ''} onChange={(e) => setA({ priority: (e.target.value as Priority) || undefined })}>
              <option value="">No cambiar</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group className="col-md-6">
            <Form.Label htmlFor="rg-follow">Añadir al seguimiento</Form.Label>
            <Personas id="rg-follow" valor={a.addFollowerIds ?? []} equipo={equipo} cambiar={(v) => setA({ addFollowerIds: v.length ? v : undefined })} />
          </Form.Group>
          <Form.Group className="col-md-6">
            <Form.Label htmlFor="rg-notify">Avisar a</Form.Label>
            <Personas id="rg-notify" valor={a.notifyUserIds ?? []} equipo={equipo} cambiar={(v) => setA({ notifyUserIds: v.length ? v : undefined })} />
          </Form.Group>
          <Form.Group className="col-md-6" controlId="rg-tags">
            <Form.Label>Añadir etiquetas</Form.Label>
            <Form.Control value={(a.addTags ?? []).join(', ')} onChange={(e) => setA({ addTags: e.target.value ? e.target.value.split(',').map((t) => t.trim()) : undefined })} placeholder="separadas por comas" />
          </Form.Group>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>Cancelar</Button>
        <Button className="btn-brand" onClick={() => void guardar()} disabled={guardando || !f.name.trim()}>Guardar</Button>
      </Modal.Footer>
    </Modal>
  );
}
