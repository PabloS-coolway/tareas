import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, ButtonGroup, Card, Form, Spinner } from 'react-bootstrap';
import { Kanban, ListUl, Plus } from 'react-bootstrap-icons';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { PRIORITIES, PRIORITY_LABELS, TASK_TYPES, TASK_TYPE_LABELS, type Priority, type ProjectDto, type TaskDto, type TaskType, type UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { Avatar, EstadoPill, PrioridadPill, TaskCard, TipoPill, Vence } from '../components/tareas-ui';
import { NuevaTareaModal } from '../components/NuevaTareaModal';
import { Column, DataTable, useMemoryTable } from '../components/table';
import { Skeleton } from '../components/Skeleton';

type Vista = 'tablero' | 'lista';
const VISTA_KEY = 'tareas.vista';

export function TableroPage() {
  const { key = '' } = useParams();
  const { hasFeature } = useAuth();
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [equipo, setEquipo] = useState<UserRefDto[]>([]);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<Vista>(() => (localStorage.getItem(VISTA_KEY) as Vista) || 'tablero');
  const [nueva, setNueva] = useState(false);
  const [saving, setSaving] = useState(false);

  // filtros
  const [q, setQ] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('');
  const [type, setType] = useState('');
  const [verEpicas, setVerEpicas] = useState(false);

  const cambiarVista = (v: Vista) => {
    setVista(v);
    localStorage.setItem(VISTA_KEY, v);
  };

  const load = useCallback(async () => {
    setError('');
    try {
      const p = await tareasGateway.proyecto(key);
      setProject(p);
      const page = await tareasGateway.tareas({
        projectId: p.id,
        board: !verEpicas,
        type: verEpicas ? 'EPIC' : (type as TaskType) || undefined,
        includeDone: true,
        doneDays: 14,
        assigneeId: assignee === 'me' || assignee === 'none' ? assignee : assignee ? Number(assignee) : undefined,
        priority: (priority as Priority) || undefined,
        q: q || undefined,
        pageSize: 1000,
      });
      setTasks(page.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [key, verEpicas, type, assignee, priority, q]);

  useEffect(() => {
    setTasks(null);
    const t = setTimeout(() => void load(), q ? 250 : 0); // pequeña espera al teclear
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    tareasGateway.directorio().then(setEquipo).catch(() => setEquipo([]));
  }, []);

  const porEstado = useMemo(() => {
    const m = new Map<number, TaskDto[]>();
    for (const s of project?.statuses ?? []) m.set(s.id, []);
    for (const t of tasks ?? []) m.get(t.status.id)?.push(t);
    return m;
  }, [project, tasks]);

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination || !tasks || !project) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const id = Number(draggableId);
    const statusId = Number(destination.droppableId);
    const status = project.statuses.find((s) => s.id === statusId);
    if (!status) return;

    // Optimista: se recoloca en local y se confirma con la API.
    const antes = tasks;
    const moved = tasks.find((t) => t.id === id);
    if (!moved) return;
    const col = (porEstado.get(statusId) ?? []).filter((t) => t.id !== id);
    col.splice(destination.index, 0, { ...moved, status });
    const resto = tasks.filter((t) => t.status.id !== statusId && t.id !== id);
    setTasks([...resto, ...col.map((t, i) => ({ ...t, order: i }))]);
    setSaving(true);
    try {
      await tareasGateway.moverTarea(id, { statusId, index: destination.index });
      void load();
    } catch (e) {
      setTasks(antes);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns = useMemo<Column<TaskDto>[]>(
    () => [
      { key: 'key', label: 'clave', value: (t) => t.key, filter: 'text', render: (t) => <Link to={`/t/${t.key}`} className="task-key">{t.key}</Link> },
      { key: 'title', label: 'título', value: (t) => t.title, filter: 'text', render: (t) => <Link to={`/t/${t.key}`} className="text-decoration-none fw-medium">{t.title}</Link> },
      { key: 'type', label: 'tipo', value: (t) => TASK_TYPE_LABELS[t.type], render: (t) => <TipoPill t={t.type} /> },
      { key: 'status', label: 'estado', value: (t) => t.status.name, render: (t) => <EstadoPill s={t.status} /> },
      { key: 'priority', label: 'prioridad', value: (t) => PRIORITY_LABELS[t.priority], render: (t) => <PrioridadPill p={t.priority} /> },
      { key: 'assignee', label: 'asignado', value: (t) => t.assignee?.name ?? '', render: (t) => <span className="d-inline-flex align-items-center gap-2"><Avatar user={t.assignee} />{t.assignee?.name ?? <span className="text-secondary">—</span>}</span> },
      { key: 'due', label: 'vence', value: (t) => t.dueDate ?? '', render: (t) => <Vence date={t.dueDate} done={t.status.category === 'DONE'} /> },
      { key: 'parent', label: 'épica / padre', value: (t) => t.parentKey ?? '', render: (t) => (t.parentKey ? <Link to={`/t/${t.parentKey}`} className="task-key">{t.parentKey}</Link> : null) },
    ],
    [],
  );
  const tabla = useMemoryTable(tasks ?? [], columns);

  if (error && !project) return <div className="page"><Alert variant="danger">⚠ {error}</Alert></div>;

  return (
    <div className="page page-board">
      <header className="page-head mb-3 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div className="d-flex align-items-center gap-2">
          {project && <span className="proj-color" style={{ background: project.color, width: 14, height: 14 }} />}
          <div>
            <h1 className="h4 mb-0">{project?.name ?? key}</h1>
            <div className="small text-secondary">
              <span className="proj-key">{key}</span>
              {project && <> · {project.openCount} abiertas{project.mineCount > 0 && <> · {project.mineCount} tuyas</>}</>}
              {saving && <Spinner as="span" size="sm" animation="border" className="ms-2" />}
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <ButtonGroup className="view-toggle">
            <Button variant={vista === 'tablero' ? 'primary' : 'outline-secondary'} size="sm" onClick={() => cambiarVista('tablero')} title="Tablero"><Kanban /></Button>
            <Button variant={vista === 'lista' ? 'primary' : 'outline-secondary'} size="sm" onClick={() => cambiarVista('lista')} title="Lista"><ListUl /></Button>
          </ButtonGroup>
          {hasFeature('tareas.editar') && project && (
            <Button className="btn-brand" size="sm" onClick={() => setNueva(true)}><Plus /> Nueva tarea</Button>
          )}
        </div>
      </header>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}

      <div className="board-toolbar">
        <Form.Control id="tb-q" size="sm" className="grow" placeholder="Buscar por título o clave…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Form.Select id="tb-assignee" size="sm" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Cualquier asignado</option>
          <option value="me">Mías</option>
          <option value="none">Sin asignar</option>
          {equipo.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Form.Select>
        <Form.Select id="tb-prio" size="sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Cualquier prioridad</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </Form.Select>
        <Form.Select id="tb-type" size="sm" value={type} onChange={(e) => setType(e.target.value)} disabled={verEpicas}>
          <option value="">Cualquier tipo</option>
          {TASK_TYPES.filter((t) => t !== 'EPIC').map((t) => <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>)}
        </Form.Select>
        <Form.Check type="switch" id="tb-epics" label="Épicas" checked={verEpicas} onChange={(e) => setVerEpicas(e.target.checked)} className="small" />
      </div>

      {!project || !tasks ? (
        <div className="board">{[0, 1, 2].map((i) => <div key={i} className="board-col p-2"><Skeleton className="skeleton-rounded" width="100%" height={160} /></div>)}</div>
      ) : vista === 'tablero' ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="board">
            {project.statuses.map((s) => {
              const col = porEstado.get(s.id) ?? [];
              return (
                <div key={s.id} className="board-col">
                  <div className="board-col-head">
                    <span className="status-dot" style={{ background: s.color }} />
                    {s.name}
                    <span className="count">{col.length}</span>
                  </div>
                  <Droppable droppableId={String(s.id)} isDropDisabled={!hasFeature('tareas.editar')}>
                    {(prov, snap) => (
                      <div ref={prov.innerRef} {...prov.droppableProps} className={`board-col-body ${snap.isDraggingOver ? 'over' : ''}`}>
                        {col.map((t, i) => (
                          <Draggable key={t.id} draggableId={String(t.id)} index={i} isDragDisabled={!hasFeature('tareas.editar')}>
                            {(dp, ds) => (
                              <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps}>
                                <TaskCard task={t} dragging={ds.isDragging} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {prov.placeholder}
                        {col.length === 0 && !snap.isDraggingOver && <div className="text-secondary small text-center py-3">vacío</div>}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        <Card>
          <Card.Body className="p-3">
            <DataTable model={tabla} allRows={tasks} rowKey={(t) => String(t.id)} empty="Ninguna tarea cumple el filtro." />
          </Card.Body>
        </Card>
      )}

      {nueva && project && (
        <NuevaTareaModal
          project={project}
          onClose={() => setNueva(false)}
          onCreated={() => {
            setNueva(false);
            void load();
          }}
        />
      )}
    </div>
  );
}
