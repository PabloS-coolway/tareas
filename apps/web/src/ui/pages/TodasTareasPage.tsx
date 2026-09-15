import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, ButtonGroup, Card, Form } from 'react-bootstrap';
import { Download, Kanban, ListUl } from 'react-bootstrap-icons';
import { PRIORITIES, PRIORITY_LABELS, TASK_TYPES, TASK_TYPE_LABELS, type Priority, type SprintDto, type TagCountDto, type TaskDto, type TaskType, type UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { Avatar, EstadoPill, Etiquetas, PrioridadPill, Puntos, TipoPill, Vence } from '../components/tareas-ui';
import { Column, DataTable, exportarCsv, useMemoryTable } from '../components/table';
import { VistasGuardadas } from '../components/VistasGuardadas';
import type { ViewFilters } from '@yorga/contracts';
import { Skeleton } from '../components/Skeleton';
import { TableroGlobal } from '../components/TableroGlobal';
import { useProyectos } from '../proyectos/ProyectosContext';

type Vista = 'tablero' | 'lista';
const VISTA_KEY = 'tareas.vista.global';

/** Todas las tareas de todos los proyectos: tablero (mismos estados en todos) o lista, con filtros. */
export function TodasTareasPage() {
  const { proyectos } = useProyectos();
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [equipo, setEquipo] = useState<UserRefDto[]>([]);
  const [sprints, setSprints] = useState<SprintDto[]>([]);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<Vista>(() => (localStorage.getItem(VISTA_KEY) as Vista) || 'tablero');

  // filtros (los resuelve el servidor)
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('');
  const [type, setType] = useState('');
  const [sprint, setSprint] = useState('');
  const [tag, setTag] = useState('');
  const [soloVencidas, setSoloVencidas] = useState(false);
  const [etiquetas, setEtiquetas] = useState<TagCountDto[]>([]);
  const [includeDone, setIncludeDone] = useState(false);

  const filtrosActuales: ViewFilters = { q, projectId, assignee, priority, type, sprint, tag, soloVencidas, includeDone };
  const aplicarVista = (f: ViewFilters) => {
    setQ(String(f.q ?? ''));
    setProjectId(String(f.projectId ?? ''));
    setAssignee(String(f.assignee ?? ''));
    setPriority(String(f.priority ?? ''));
    setType(String(f.type ?? ''));
    setSprint(String(f.sprint ?? ''));
    setTag(String(f.tag ?? ''));
    setSoloVencidas(!!f.soloVencidas);
    setIncludeDone(!!f.includeDone);
  };

  const cambiarVista = (v: Vista) => {
    setVista(v);
    localStorage.setItem(VISTA_KEY, v);
  };

  useEffect(() => {
    tareasGateway.directorio().then(setEquipo).catch(() => setEquipo([]));
    tareasGateway.sprints(true).then(setSprints).catch(() => setSprints([]));
    tareasGateway.etiquetas().then(setEtiquetas).catch(() => setEtiquetas([]));
  }, []);

  const load = useCallback(async () => {
    setError('');
    try {
      const p = await tareasGateway.tareas({
        projectId: projectId ? Number(projectId) : undefined,
        assigneeId: assignee === 'me' || assignee === 'none' ? assignee : assignee ? Number(assignee) : undefined,
        priority: (priority as Priority) || undefined,
        type: (type as TaskType) || undefined,
        sprintId: sprint === 'none' ? 'none' : sprint ? Number(sprint) : undefined,
        tag: tag || undefined,
        overdue: soloVencidas || undefined,
        q: q || undefined,
        // En tablero: sin épicas ni subtareas (como en el de cada proyecto) y las terminadas de los últimos 14 días.
        board: vista === 'tablero',
        includeDone: vista === 'tablero' ? true : includeDone,
        doneDays: vista === 'tablero' ? 14 : includeDone ? 30 : undefined,
        pageSize: 1000,
      });
      setTasks(p.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q, projectId, assignee, priority, type, sprint, tag, soloVencidas, includeDone, vista]);

  useEffect(() => {
    setTasks(null);
    const t = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const proyectoDe = useMemo(() => new Map(proyectos.map((p) => [p.id, p])), [proyectos]);

  const columns = useMemo<Column<TaskDto>[]>(
    () => [
      { key: 'key', label: 'clave', value: (t) => t.key, filter: 'text', render: (t) => <Link to={`/t/${t.key}`} className="task-key">{t.key}</Link> },
      {
        key: 'project',
        label: 'proyecto',
        value: (t) => proyectoDe.get(t.projectId)?.name ?? t.projectKey,
        render: (t) => {
          const p = proyectoDe.get(t.projectId);
          return (
            <Link to={`/p/${t.projectKey}`} className="text-decoration-none d-inline-flex align-items-center gap-2 text-nowrap">
              <span className="nav-proj-dot" style={{ background: p?.color ?? 'var(--muted)' }} />{p?.name ?? t.projectKey}
            </Link>
          );
        },
      },
      { key: 'title', label: 'título', value: (t) => t.title, filter: 'text', render: (t) => <Link to={`/t/${t.key}`} className="text-decoration-none fw-medium lista-titulo">{t.title}</Link> },
      { key: 'type', label: 'tipo', value: (t) => TASK_TYPE_LABELS[t.type], render: (t) => <TipoPill t={t.type} /> },
      { key: 'status', label: 'estado', value: (t) => t.status.name, render: (t) => <EstadoPill s={t.status} /> },
      { key: 'priority', label: 'prioridad', value: (t) => PRIORITY_LABELS[t.priority], render: (t) => <PrioridadPill p={t.priority} /> },
      { key: 'assignee', label: 'asignado', value: (t) => t.assignee?.name ?? '', render: (t) => <span className="d-inline-flex align-items-center gap-2"><Avatar user={t.assignee} />{t.assignee?.name ?? <span className="text-secondary">—</span>}</span> },
      { key: 'sprint', label: 'sprint', value: (t) => t.sprintName ?? '', render: (t) => (t.sprintId ? <Link to={`/sprints/${t.sprintId}`} className="text-decoration-none text-nowrap">{t.sprintName}</Link> : <span className="text-secondary">—</span>) },
      { key: 'tags', label: 'etiquetas', value: (t) => t.tags.join(', '), render: (t) => <Etiquetas tags={t.tags} onClick={setTag} /> },
      { key: 'estimate', label: 'pt', value: (t) => t.estimate ?? '', align: 'end', render: (t) => <Puntos n={t.estimate} /> },
      { key: 'due', label: 'vence', value: (t) => t.dueDate ?? '', render: (t) => <Vence date={t.dueDate} done={t.status.category === 'DONE'} /> },
      { key: 'parent', label: 'épica / padre', value: (t) => t.parentKey ?? '', render: (t) => (t.parentKey ? <Link to={`/t/${t.parentKey}`} className="task-key">{t.parentKey}</Link> : null) },
    ],
    [proyectoDe],
  );
  const tabla = useMemoryTable(tasks ?? [], columns);

  const abiertas = tasks?.filter((t) => t.status.category !== 'DONE').length ?? 0;
  const hoy = new Date().toISOString().slice(0, 10);
  const vencidas = tasks?.filter((t) => t.status.category !== 'DONE' && t.dueDate && t.dueDate < hoy).length ?? 0;

  return (
    <div className="page page-board">
      <header className="page-head mb-3 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-0">Todas las tareas</h1>
          <div className="small text-secondary">
            Todos los proyectos, un solo tablero
            {tasks && <> · {abiertas} abiertas{vencidas > 0 && <span className="text-danger"> · {vencidas} vencidas</span>}</>}
          </div>
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          {vista === 'lista' && <Form.Check type="switch" id="tt-done" label="Incluir terminadas (30 días)" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} />}
          <VistasGuardadas scope="global" actual={filtrosActuales} aplicar={aplicarVista} onError={setError} />
          <ButtonGroup className="view-toggle">
            <Button variant={vista === 'tablero' ? 'primary' : 'outline-secondary'} size="sm" onClick={() => cambiarVista('tablero')} title="Tablero"><Kanban /></Button>
            <Button variant={vista === 'lista' ? 'primary' : 'outline-secondary'} size="sm" onClick={() => cambiarVista('lista')} title="Lista"><ListUl /></Button>
          </ButtonGroup>
          {vista === 'lista' && tasks && <Button size="sm" variant="outline-secondary" title="Exportar CSV" onClick={() => exportarCsv('todas-las-tareas', columns, tabla.rows.length ? tabla.rows : tasks)}><Download /></Button>}
        </div>
      </header>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}

      <div className="board-toolbar">
        <Form.Control id="tt-q" size="sm" className="grow" placeholder="Buscar por título o clave…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Form.Select id="tt-project" size="sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {proyectos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Form.Select>
        <Form.Select id="tt-sprint" size="sm" value={sprint} onChange={(e) => setSprint(e.target.value)}>
          <option value="">Cualquier sprint</option>
          <option value="none">Backlog (sin sprint)</option>
          {sprints.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}{sp.status === 'CLOSED' ? ' (cerrado)' : sp.status === 'ACTIVE' ? ' · en curso' : ''}</option>)}
        </Form.Select>
        <Form.Select id="tt-assignee" size="sm" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Cualquier asignado</option>
          <option value="me">Mías</option>
          <option value="none">Sin asignar</option>
          {equipo.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Form.Select>
        <Form.Select id="tt-prio" size="sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Cualquier prioridad</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </Form.Select>
        <Form.Select id="tt-type" size="sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Cualquier tipo</option>
          {TASK_TYPES.map((t) => <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>)}
        </Form.Select>
        {(etiquetas.length > 0 || tag) && (
          <Form.Select id="tt-tag" size="sm" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Cualquier etiqueta</option>
            {etiquetas.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>)}
          </Form.Select>
        )}
        <button type="button" className={`toolbar-chip ${soloVencidas ? 'on' : ''}`} onClick={() => setSoloVencidas((v) => !v)} title="Sólo las que han pasado su fecha límite">Vencidas</button>
      </div>

      {!tasks ? (
        <div className="board">{[0, 1, 2].map((i) => <div key={i} className="board-col p-2"><Skeleton className="skeleton-rounded" width="100%" height={160} /></div>)}</div>
      ) : vista === 'tablero' ? (
        <TableroGlobal tasks={tasks} setTasks={setTasks} onChanged={() => void load()} />
      ) : (
        <Card>
          <Card.Body className="p-3">
            <DataTable model={tabla} allRows={tasks} rowKey={(t) => String(t.id)} empty="Ninguna tarea cumple el filtro." />
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
