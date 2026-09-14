import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, ButtonGroup, Card, Form, Modal, ProgressBar, Spinner } from 'react-bootstrap';
import { Kanban, ListUl, Pencil, Plus } from 'react-bootstrap-icons';
import { PRIORITY_LABELS, TASK_TYPE_LABELS, type SprintDto, type TaskDto, type UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { Avatar, EstadoPill, PrioridadPill, TipoPill, Vence } from '../components/tareas-ui';
import { Column, DataTable, useMemoryTable } from '../components/table';
import { Skeleton } from '../components/Skeleton';
import { TableroGlobal } from '../components/TableroGlobal';
import { useProyectos } from '../proyectos/ProyectosContext';
import { SprintBadge, SprintModal, rangoSprint } from './SprintsPage';

type Vista = 'tablero' | 'lista';
const VISTA_KEY = 'tareas.vista.sprint';

/** Un sprint: su tablero (tareas de todos los proyectos), planificación y cierre. */
export function SprintPage() {
  const { id = '' } = useParams();
  const sprintId = Number(id);
  const navigate = useNavigate();
  const { hasFeature } = useAuth();
  const { proyectos } = useProyectos();
  const [sprint, setSprint] = useState<SprintDto | null>(null);
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [equipo, setEquipo] = useState<UserRefDto[]>([]);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<Vista>(() => (localStorage.getItem(VISTA_KEY) as Vista) || 'tablero');
  const [assignee, setAssignee] = useState('');
  const [projectId, setProjectId] = useState('');
  const [editar, setEditar] = useState(false);
  const [anadir, setAnadir] = useState(false);
  const [cerrar, setCerrar] = useState(false);
  const [busy, setBusy] = useState(false);
  const puede = hasFeature('tareas.editar');

  const cambiarVista = (v: Vista) => {
    setVista(v);
    localStorage.setItem(VISTA_KEY, v);
  };

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, p] = await Promise.all([
        tareasGateway.sprint(sprintId),
        tareasGateway.tareas({
          sprintId,
          projectId: projectId ? Number(projectId) : undefined,
          assigneeId: assignee === 'me' || assignee === 'none' ? assignee : assignee ? Number(assignee) : undefined,
          includeDone: true,
          pageSize: 1000,
        }),
      ]);
      setSprint(s);
      setTasks(p.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [sprintId, projectId, assignee]);

  useEffect(() => {
    setTasks(null);
    void load();
  }, [load]);

  useEffect(() => {
    tareasGateway.directorio().then(setEquipo).catch(() => setEquipo([]));
  }, []);

  async function activar() {
    if (!sprint) return;
    setBusy(true);
    try {
      setSprint(await tareasGateway.editarSprint(sprint.id, { status: sprint.status === 'ACTIVE' ? 'PLANNED' : 'ACTIVE' }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function quitar(t: TaskDto) {
    setBusy(true);
    try {
      await tareasGateway.editarTarea(t.id, { sprintId: null });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const proyectoDe = useMemo(() => new Map(proyectos.map((p) => [p.id, p])), [proyectos]);
  const columns = useMemo<Column<TaskDto>[]>(
    () => [
      { key: 'key', label: 'clave', value: (t) => t.key, filter: 'text', render: (t) => <Link to={`/t/${t.key}`} className="task-key">{t.key}</Link> },
      { key: 'project', label: 'proyecto', value: (t) => proyectoDe.get(t.projectId)?.name ?? t.projectKey, render: (t) => <span className="d-inline-flex align-items-center gap-2 text-nowrap"><span className="nav-proj-dot" style={{ background: proyectoDe.get(t.projectId)?.color ?? 'var(--muted)' }} />{proyectoDe.get(t.projectId)?.name ?? t.projectKey}</span> },
      { key: 'title', label: 'título', value: (t) => t.title, filter: 'text', render: (t) => <Link to={`/t/${t.key}`} className="text-decoration-none fw-medium lista-titulo">{t.title}</Link> },
      { key: 'type', label: 'tipo', value: (t) => TASK_TYPE_LABELS[t.type], render: (t) => <TipoPill t={t.type} /> },
      { key: 'status', label: 'estado', value: (t) => t.status.name, render: (t) => <EstadoPill s={t.status} /> },
      { key: 'priority', label: 'prioridad', value: (t) => PRIORITY_LABELS[t.priority], render: (t) => <PrioridadPill p={t.priority} /> },
      { key: 'assignee', label: 'asignado', value: (t) => t.assignee?.name ?? '', render: (t) => <span className="d-inline-flex align-items-center gap-2"><Avatar user={t.assignee} />{t.assignee?.name ?? <span className="text-secondary">—</span>}</span> },
      { key: 'due', label: 'vence', value: (t) => t.dueDate ?? '', render: (t) => <Vence date={t.dueDate} done={t.status.category === 'DONE'} /> },
      ...(puede && sprint?.status !== 'CLOSED'
        ? [{ key: 'acciones', label: '', value: () => '', sortable: false, filter: 'none' as const, align: 'end' as const, render: (t: TaskDto) => <Button size="sm" variant="link" className="p-0 small" disabled={busy} onClick={() => quitar(t)}>quitar</Button> }]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [proyectoDe, puede, sprint?.status, busy],
  );
  const tabla = useMemoryTable(tasks ?? [], columns);

  if (error && !sprint) return <div className="page"><Alert variant="danger">⚠ {error}</Alert></div>;
  const pct = sprint?.total ? Math.round((sprint.done / sprint.total) * 100) : 0;
  const abierto = sprint?.status !== 'CLOSED';

  return (
    <div className="page page-board">
      <header className="page-head mb-3 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div style={{ minWidth: 0 }}>
          <div className="small text-secondary"><Link to="/sprints" className="text-decoration-none">Sprints</Link> /</div>
          <h1 className="h4 mb-0 d-flex align-items-center gap-2 flex-wrap">
            {sprint?.name ?? '…'}
            {sprint && <SprintBadge s={sprint} />}
            {busy && <Spinner as="span" size="sm" animation="border" />}
          </h1>
          {sprint && (
            <div className="small text-secondary">
              {rangoSprint(sprint)} · {sprint.done} de {sprint.total} terminadas ({pct}%)
              {sprint.goal && <div className="sprint-goal mt-1">{sprint.goal}</div>}
            </div>
          )}
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <ButtonGroup className="view-toggle">
            <Button variant={vista === 'tablero' ? 'primary' : 'outline-secondary'} size="sm" onClick={() => cambiarVista('tablero')} title="Tablero"><Kanban /></Button>
            <Button variant={vista === 'lista' ? 'primary' : 'outline-secondary'} size="sm" onClick={() => cambiarVista('lista')} title="Lista"><ListUl /></Button>
          </ButtonGroup>
          {puede && sprint && (
            <>
              <Button size="sm" variant="outline-secondary" onClick={() => setEditar(true)} title="Editar"><Pencil /></Button>
              {abierto && <Button size="sm" variant="outline-secondary" disabled={busy} onClick={activar}>{sprint.status === 'ACTIVE' ? 'Pausar' : 'Activar'}</Button>}
              {abierto && <Button size="sm" className="btn-brand" onClick={() => setAnadir(true)}><Plus /> Añadir tareas</Button>}
              {abierto && <Button size="sm" variant="outline-danger" onClick={() => setCerrar(true)}>Cerrar sprint</Button>}
            </>
          )}
        </div>
      </header>

      {sprint && <ProgressBar now={pct} variant={pct === 100 ? 'success' : undefined} className="sprint-progress mb-3" />}
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}

      <div className="board-toolbar">
        <Form.Select id="sp-project" size="sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {proyectos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Form.Select>
        <Form.Select id="sp-assignee" size="sm" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Cualquier asignado</option>
          <option value="me">Mías</option>
          <option value="none">Sin asignar</option>
          {equipo.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Form.Select>
      </div>

      {!tasks || !sprint ? (
        <div className="board">{[0, 1, 2].map((i) => <div key={i} className="board-col p-2"><Skeleton className="skeleton-rounded" width="100%" height={160} /></div>)}</div>
      ) : tasks.length === 0 ? (
        <Card><Card.Body className="text-secondary">Este sprint no tiene tareas{abierto && puede ? '. Añádelas desde el backlog con «Añadir tareas»' : ''}.</Card.Body></Card>
      ) : vista === 'tablero' ? (
        <TableroGlobal tasks={tasks} setTasks={setTasks} onChanged={() => void load()} />
      ) : (
        <Card>
          <Card.Body className="p-3">
            <DataTable model={tabla} allRows={tasks} rowKey={(t) => String(t.id)} empty="Ninguna tarea cumple el filtro." />
          </Card.Body>
        </Card>
      )}

      {editar && sprint && (
        <SprintModal
          sprint={sprint}
          onClose={() => setEditar(false)}
          onSaved={(s) => {
            setSprint(s);
            setEditar(false);
          }}
        />
      )}
      {anadir && sprint && (
        <AnadirTareasModal
          sprint={sprint}
          onClose={() => setAnadir(false)}
          onDone={() => {
            setAnadir(false);
            void load();
          }}
        />
      )}
      {cerrar && sprint && (
        <CerrarSprintModal
          sprint={sprint}
          abiertas={(tasks ?? []).filter((t) => t.status.category !== 'DONE').length}
          onClose={() => setCerrar(false)}
          onDone={() => {
            setCerrar(false);
            navigate('/sprints');
          }}
        />
      )}
    </div>
  );
}

/** Elegir tareas del backlog (abiertas y sin sprint) y meterlas en el sprint. */
function AnadirTareasModal({ sprint, onClose, onDone }: { sprint: SprintDto; onClose: () => void; onDone: () => void }) {
  const { proyectos } = useProyectos();
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTasks(null);
    const t = setTimeout(() => {
      tareasGateway
        .tareas({ sprintId: 'none', projectId: projectId ? Number(projectId) : undefined, q: q || undefined, board: true, pageSize: 500 })
        .then((p) => setTasks(p.items))
        .catch((e) => setError((e as Error).message));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, projectId]);

  const toggle = (id: number) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  async function guardar() {
    setSaving(true);
    setError('');
    try {
      for (const id of sel) await tareasGateway.editarTarea(id, { sprintId: sprint.id });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal show onHide={onClose} size="lg" centered scrollable>
      <Modal.Header closeButton><Modal.Title>Añadir tareas a {sprint.name}</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">⚠ {error}</Alert>}
        <div className="d-flex gap-2 mb-3">
          <Form.Control size="sm" autoFocus placeholder="Buscar en el backlog…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Form.Select size="sm" style={{ width: 'auto' }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {proyectos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Form.Select>
        </div>
        {!tasks ? (
          <Skeleton className="skeleton-rounded" width="100%" height={160} />
        ) : tasks.length === 0 ? (
          <div className="text-secondary small">No hay tareas abiertas sin sprint que cumplan el filtro.</div>
        ) : (
          <div className="backlog-list">
            {tasks.map((t) => (
              <label key={t.id} className={`backlog-row ${sel.has(t.id) ? 'sel' : ''}`}>
                <Form.Check type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} />
                <span className="task-key">{t.key}</span>
                <span className="title">{t.title}</span>
                <span className="hide-sm"><EstadoPill s={t.status} /></span>
                <span className="hide-sm">{t.priority !== 'NORMAL' ? <PrioridadPill p={t.priority} /> : null}</span>
                <Avatar user={t.assignee} />
              </label>
            ))}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <span className="me-auto small text-secondary">{sel.size} seleccionadas</span>
        <Button variant="outline-secondary" onClick={onClose}>Cancelar</Button>
        <Button className="btn-brand" disabled={saving || sel.size === 0} onClick={guardar}>{saving ? <Spinner size="sm" animation="border" /> : `Añadir ${sel.size || ''}`}</Button>
      </Modal.Footer>
    </Modal>
  );
}

/** Cerrar el sprint decidiendo a dónde va lo no terminado. */
function CerrarSprintModal({ sprint, abiertas, onClose, onDone }: { sprint: SprintDto; abiertas: number; onClose: () => void; onDone: () => void }) {
  const [otros, setOtros] = useState<SprintDto[]>([]);
  const [destino, setDestino] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    tareasGateway.sprints().then((ss) => setOtros(ss.filter((s) => s.id !== sprint.id))).catch(() => setOtros([]));
  }, [sprint.id]);

  async function cerrar() {
    setSaving(true);
    setError('');
    try {
      await tareasGateway.cerrarSprint(sprint.id, { moveOpenTo: destino ? Number(destino) : null });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>Cerrar {sprint.name}</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">⚠ {error}</Alert>}
        <p className="mb-2">{sprint.done} de {sprint.total} tareas terminadas.</p>
        {abiertas > 0 ? (
          <Form.Group>
            <Form.Label className="small">Las {abiertas} que quedan abiertas van a…</Form.Label>
            <Form.Select id="cs-dest" value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Backlog (sin sprint)</option>
              {otros.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Form.Select>
          </Form.Group>
        ) : (
          <p className="text-secondary small mb-0">Todo terminado. Buen sprint.</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" disabled={saving} onClick={cerrar}>{saving ? <Spinner size="sm" animation="border" /> : 'Cerrar sprint'}</Button>
      </Modal.Footer>
    </Modal>
  );
}
