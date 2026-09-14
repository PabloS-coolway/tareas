import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Form } from 'react-bootstrap';
import { PRIORITIES, PRIORITY_LABELS, TASK_TYPES, TASK_TYPE_LABELS, type Priority, type TaskDto, type TaskType, type UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { Avatar, EstadoPill, PrioridadPill, TipoPill, Vence } from '../components/tareas-ui';
import { Column, DataTable, useMemoryTable } from '../components/table';
import { Skeleton } from '../components/Skeleton';
import { useProyectos } from '../proyectos/ProyectosContext';

/** Todas las tareas de todos los proyectos en una sola lista, con filtros. */
export function TodasTareasPage() {
  const { proyectos } = useProyectos();
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [equipo, setEquipo] = useState<UserRefDto[]>([]);
  const [error, setError] = useState('');

  // filtros (los que resuelve el servidor)
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('');
  const [type, setType] = useState('');
  const [includeDone, setIncludeDone] = useState(false);

  useEffect(() => {
    tareasGateway.directorio().then(setEquipo).catch(() => setEquipo([]));
  }, []);

  useEffect(() => {
    setError('');
    tareasGateway
      .tareas({
        projectId: projectId ? Number(projectId) : undefined,
        assigneeId: assignee === 'me' || assignee === 'none' ? assignee : assignee ? Number(assignee) : undefined,
        priority: (priority as Priority) || undefined,
        type: (type as TaskType) || undefined,
        q: q || undefined,
        includeDone,
        doneDays: includeDone ? 30 : undefined,
        pageSize: 1000,
      })
      .then((p) => setTasks(p.items))
      .catch((e) => setError((e as Error).message));
  }, [q, projectId, assignee, priority, type, includeDone]);

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
            Todos los proyectos en una sola lista
            {tasks && <> · {abiertas} abiertas{vencidas > 0 && <span className="text-danger"> · {vencidas} vencidas</span>}</>}
          </div>
        </div>
        <Form.Check type="switch" id="tt-done" label="Incluir terminadas (30 días)" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} />
      </header>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}

      <div className="board-toolbar">
        <Form.Control id="tt-q" size="sm" className="grow" placeholder="Buscar por título o clave…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Form.Select id="tt-project" size="sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {proyectos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
      </div>

      {!tasks ? (
        <Skeleton className="skeleton-rounded" width="100%" height={240} />
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
