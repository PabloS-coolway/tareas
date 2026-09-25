import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, ButtonGroup, Card, Form, Spinner } from 'react-bootstrap';
import { Download, Kanban, ListUl, Plus } from 'react-bootstrap-icons';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { PRIORITIES, PRIORITY_LABELS, TASK_TYPES, TASK_TYPE_LABELS, type Priority, type ProjectDto, type SprintDto, type TagCountDto, type TaskDto, type TaskType, type UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { NovedadesProyecto } from '../components/NovedadesProyecto';
import { useAuth } from '../auth/AuthContext';
import { Avatar, EstadoPill, Etiquetas, PrioridadPill, Puntos, TaskCard, TipoPill, Vence } from '../components/tareas-ui';
import { NuevaTareaModal } from '../components/NuevaTareaModal';
import { SprintModal } from './SprintsPage';
import { Column, DataTable, exportarCsv, useMemoryTable } from '../components/table';
import { VistasGuardadas } from '../components/VistasGuardadas';
import type { ViewFilters } from '@yorga/contracts';
import { Skeleton } from '../components/Skeleton';
import { useFiltrosUrl } from '../filtros/useFiltrosUrl';
import { AccionesEnBloque } from '../components/AccionesEnBloque';

type Vista = 'tablero' | 'lista';
const VISTA_KEY = 'tareas.vista';

/** Filtros del tablero: viven en la URL para que no se pierdan al abrir una tarea y volver. */
const FILTROS = { q: '', assignee: '', priority: '', type: '', sprint: '', tag: '', vencidas: false, verEpicas: false, todasTerminadas: false, sigo: false };

export function TableroPage() {
  const { key = '' } = useParams();
  const { hasFeature } = useAuth();
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [equipo, setEquipo] = useState<UserRefDto[]>([]);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<Vista>(() => (localStorage.getItem(VISTA_KEY) as Vista) || 'tablero');
  const [nueva, setNueva] = useState(false);
  const [nuevoSprint, setNuevoSprint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState('');

  // filtros
  const { filtros, cambiar, limpiar, activos } = useFiltrosUrl(FILTROS, `p/${key}`);
  const { q, assignee, priority, type, verEpicas, sprint, tag, vencidas, todasTerminadas, sigo } = filtros;
  const setTag = useCallback((t: string) => cambiar({ tag: t }), [cambiar]);
  const [sprints, setSprints] = useState<SprintDto[]>([]);
  const [etiquetas, setEtiquetas] = useState<TagCountDto[]>([]);
  const [epicas, setEpicas] = useState<TaskDto[]>([]);
  const [carriles, setCarriles] = useState<'' | 'assignee' | 'epic'>(() => (localStorage.getItem('tareas.carriles') as '' | 'assignee' | 'epic') || '');

  const filtrosActuales: ViewFilters = { q, assignee, priority, type, sprint, tag, vencidas, verEpicas, sigo, carriles };
  const aplicarVista = (f: ViewFilters) => {
    cambiar({
      q: String(f.q ?? ''),
      assignee: String(f.assignee ?? ''),
      priority: String(f.priority ?? ''),
      type: String(f.type ?? ''),
      sprint: String(f.sprint ?? ''),
      tag: String(f.tag ?? ''),
      vencidas: !!f.vencidas,
      verEpicas: !!f.verEpicas,
      sigo: !!f.sigo,
    });
    setCarriles((f.carriles as '' | 'assignee' | 'epic') ?? '');
  };
  const cambiarCarriles = (c: '' | 'assignee' | 'epic') => {
    setCarriles(c);
    localStorage.setItem('tareas.carriles', c);
  };

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
        // Terminadas: por defecto sólo las de los últimos 14 días (el tablero es para trabajar, no un archivo).
        doneDays: todasTerminadas ? undefined : 14,
        assigneeId: assignee === 'me' || assignee === 'none' ? assignee : assignee ? Number(assignee) : undefined,
        priority: (priority as Priority) || undefined,
        sprintId: sprint === 'none' ? 'none' : sprint ? Number(sprint) : undefined,
        tag: tag || undefined,
        overdue: vencidas || undefined,
        followedBy: sigo ? 'me' : undefined,
        q: q || undefined,
        pageSize: 1000,
      });
      setTasks(page.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [key, verEpicas, type, assignee, priority, q, sprint, tag, vencidas, todasTerminadas, sigo]);

  useEffect(() => {
    setTasks(null);
    const t = setTimeout(() => void load(), q ? 250 : 0); // pequeña espera al teclear
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    tareasGateway.directorio().then(setEquipo).catch(() => setEquipo([]));
  }, []);

  // Sprints que admiten tareas de ESTE proyecto (transversales + los suyos).
  useEffect(() => {
    if (project) tareasGateway.sprints(false, project.id).then(setSprints).catch(() => setSprints([]));
  }, [project?.id, nuevoSprint]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (project) tareasGateway.etiquetas(project.id).then(setEtiquetas).catch(() => setEtiquetas([]));
  }, [project?.id, tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (project && carriles === 'epic') tareasGateway.tareas({ projectId: project.id, type: 'EPIC', includeDone: true, pageSize: 200 }).then((p) => setEpicas(p.items)).catch(() => setEpicas([]));
  }, [project?.id, carriles]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const [laneDest, statusPart] = destination.droppableId.includes('|') ? destination.droppableId.split('|') : [null, destination.droppableId];
    const [laneSrc] = source.droppableId.includes('|') ? source.droppableId.split('|') : [null];
    const statusId = Number(statusPart);
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
      // Cambio de carril: reasigna (persona) o cambia de épica antes de mover.
      if (laneDest !== null && laneDest !== laneSrc) {
        if (carriles === 'assignee') await tareasGateway.editarTarea(id, { assigneeId: laneDest === 'none' ? null : Number(laneDest) });
        else if (carriles === 'epic') await tareasGateway.editarTarea(id, { parentId: laneDest === 'none' ? null : Number(laneDest) });
      }
      // Índice dentro de la columna del proyecto (no del carril): cuenta las que quedan delante en toda la columna.
      const index = laneDest === null ? destination.index : col.findIndex((t) => t.id === id);
      await tareasGateway.moverTarea(id, { statusId, index: index < 0 ? destination.index : index });
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
      { key: 'title', label: 'título', value: (t) => t.title, filter: 'text', render: (t) => <Link to={`/t/${t.key}`} className="text-decoration-none fw-medium lista-titulo">{t.title}</Link> },
      { key: 'type', label: 'tipo', value: (t) => TASK_TYPE_LABELS[t.type], render: (t) => <TipoPill t={t.type} /> },
      { key: 'status', label: 'estado', value: (t) => t.status.name, render: (t) => <EstadoPill s={t.status} /> },
      { key: 'priority', label: 'prioridad', value: (t) => PRIORITY_LABELS[t.priority], render: (t) => <PrioridadPill p={t.priority} /> },
      { key: 'assignee', label: 'asignado', value: (t) => t.assignee?.name ?? '', render: (t) => <span className="d-inline-flex align-items-center gap-2"><Avatar user={t.assignee} />{t.assignee?.name ?? <span className="text-secondary">—</span>}</span> },
      { key: 'tags', label: 'etiquetas', value: (t) => t.tags.join(', '), render: (t) => <Etiquetas tags={t.tags} onClick={setTag} /> },
      { key: 'estimate', label: 'pt', value: (t) => t.estimate ?? '', align: 'end', render: (t) => <Puntos n={t.estimate} /> },
      { key: 'due', label: 'vence', value: (t) => t.dueDate ?? '', render: (t) => <Vence date={t.dueDate} done={t.status.category === 'DONE'} /> },
      { key: 'parent', label: 'épica / padre', value: (t) => t.parentKey ?? '', render: (t) => (t.parentKey ? <Link to={`/t/${t.parentKey}`} className="task-key">{t.parentKey}</Link> : null) },
    ],
    [setTag],
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
          {project && <VistasGuardadas scope="project" projectId={project.id} actual={filtrosActuales} aplicar={aplicarVista} onError={setError} />}
          <ButtonGroup className="view-toggle">
            <Button variant={vista === 'tablero' ? 'primary' : 'outline-secondary'} size="sm" onClick={() => cambiarVista('tablero')} title="Tablero"><Kanban /></Button>
            <Button variant={vista === 'lista' ? 'primary' : 'outline-secondary'} size="sm" onClick={() => cambiarVista('lista')} title="Lista"><ListUl /></Button>
          </ButtonGroup>
          {vista === 'lista' && tasks && <Button size="sm" variant="outline-secondary" title="Exportar CSV" onClick={() => exportarCsv(`${key}-tareas`, columns, tabla.rows.length ? tabla.rows : tasks)}><Download /></Button>}
          {hasFeature('tareas.editar') && project && (
            <>
              <Button variant="outline-secondary" size="sm" onClick={() => setNuevoSprint(true)} title="Sprint sólo con tareas de este proyecto">Nuevo sprint</Button>
              <Button className="btn-brand" size="sm" onClick={() => setNueva(true)}><Plus /> Nueva tarea</Button>
            </>
          )}
        </div>
      </header>
      <NovedadesProyecto proyecto={key} />

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}

      <div className="board-toolbar">
        <Form.Control id="tb-q" size="sm" className="grow" placeholder="Buscar por título o clave…" value={q} onChange={(e) => cambiar({ q: e.target.value })} />
        <Form.Select id="tb-assignee" size="sm" value={assignee} onChange={(e) => cambiar({ assignee: e.target.value })}>
          <option value="">Cualquier asignado</option>
          <option value="me">Mías</option>
          <option value="none">Sin asignar</option>
          {equipo.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Form.Select>
        <Form.Select id="tb-prio" size="sm" value={priority} onChange={(e) => cambiar({ priority: e.target.value })}>
          <option value="">Cualquier prioridad</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </Form.Select>
        <Form.Select id="tb-type" size="sm" value={type} onChange={(e) => cambiar({ type: e.target.value })} disabled={verEpicas}>
          <option value="">Cualquier tipo</option>
          {TASK_TYPES.filter((t) => t !== 'EPIC').map((t) => <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>)}
        </Form.Select>
        <Form.Select id="tb-sprint" size="sm" value={sprint} onChange={(e) => cambiar({ sprint: e.target.value })}>
          <option value="">Cualquier sprint</option>
          <option value="none">Backlog (sin sprint)</option>
          {sprints.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}{sp.projectId ? ` · ${sp.projectKey}` : ' · transversal'}{sp.status === 'ACTIVE' ? ' · en curso' : ''}</option>)}
        </Form.Select>
        {(etiquetas.length > 0 || tag) && (
          <Form.Select id="tb-tag" size="sm" value={tag} onChange={(e) => cambiar({ tag: e.target.value })}>
            <option value="">Cualquier etiqueta</option>
            {etiquetas.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>)}
            {tag && !etiquetas.some((t) => t.tag === tag) && <option value={tag}>{tag}</option>}
          </Form.Select>
        )}
        <button type="button" className={`toolbar-chip ${vencidas ? 'on' : ''}`} onClick={() => cambiar({ vencidas: !vencidas })} title="Sólo las que han pasado su fecha límite">Vencidas</button>
        <button type="button" className={`toolbar-chip ${sigo ? 'on' : ''}`} onClick={() => cambiar({ sigo: !sigo })} title="Sólo las tareas en las que estás de seguimiento">Sigo yo</button>
        {vista === 'tablero' && (
          <Form.Select id="tb-lanes" size="sm" value={carriles} onChange={(e) => cambiarCarriles(e.target.value as '' | 'assignee' | 'epic')} title="Carriles: agrupa el tablero en filas">
            <option value="">Sin carriles</option>
            <option value="assignee">Carriles por persona</option>
            <option value="epic">Carriles por épica</option>
          </Form.Select>
        )}
        <Form.Check type="switch" id="tb-epics" label="Épicas" checked={verEpicas} onChange={(e) => cambiar({ verEpicas: e.target.checked })} className="small" />
        <Form.Check type="switch" id="tb-alldone" label="Todas las terminadas" checked={todasTerminadas} onChange={(e) => cambiar({ todasTerminadas: e.target.checked })} className="small" title="Por defecto sólo se ven las terminadas en los últimos 14 días" />
        {activos && <button type="button" className="toolbar-chip" onClick={limpiar} title="Quitar todos los filtros">Limpiar filtros</button>}
      </div>

      {!project || !tasks ? (
        <div className="board">{[0, 1, 2].map((i) => <div key={i} className="board-col p-2"><Skeleton className="skeleton-rounded" width="100%" height={160} /></div>)}</div>
      ) : vista === 'tablero' && carriles ? (
        <DragDropContext onDragEnd={onDragEnd}>
          {carrilesDe(tasks, carriles, epicas).map((lane) => (
            <div key={lane.key} className="lane">
              <div className="lane-head">
                {carriles === 'assignee' ? <Avatar user={lane.user ?? null} /> : <span className="task-key">{lane.sub}</span>}
                {lane.label}
                <span className="count">{lane.tasks.length}</span>
              </div>
              <div className="board">
                {project.statuses.map((s) => {
                  const col = lane.tasks.filter((t) => t.status.id === s.id).sort((a, b) => a.order - b.order);
                  return (
                    <div key={s.id} className="board-col">
                      <div className="board-col-head">
                        <span className="status-dot" style={{ background: s.color }} />
                        {s.name}
                        <span className="count">{col.length}</span>
                      </div>
                      <Droppable droppableId={`${lane.key}|${s.id}`} isDropDisabled={!hasFeature('tareas.editar')}>
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
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </DragDropContext>
      ) : vista === 'tablero' ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="board">
            {project.statuses.map((s) => {
              const col = porEstado.get(s.id) ?? [];
              const puntos = col.reduce((n, t) => n + (t.estimate ?? 0), 0);
              const pasado = s.wipLimit !== null && col.length > s.wipLimit;
              return (
                <div key={s.id} className="board-col">
                  <div className={`board-col-head ${pasado ? 'over-wip' : ''}`} title={pasado ? `Supera el límite WIP de ${s.wipLimit}` : undefined}>
                    <span className="status-dot" style={{ background: s.color }} />
                    {s.name}
                    {puntos > 0 && <span className="pts">{puntos} pt</span>}
                    <span className="count">{col.length}{s.wipLimit !== null && <>/{s.wipLimit}</>}</span>
                  </div>
                  <Droppable droppableId={String(s.id)} isDropDisabled={!hasFeature('tareas.editar')}>
                    {(prov, snap) => (
                      <div ref={prov.innerRef} {...prov.droppableProps} className={`board-col-body ${snap.isDraggingOver ? 'over' : ''}`}>
                        {s.category === 'DONE' && !todasTerminadas && project.doneCount > col.length && (
                          <button type="button" className="col-foot mb-2 mt-0" onClick={() => cambiar({ todasTerminadas: true })} title="El tablero enseña sólo las terminadas de los últimos 14 días">
                            Últimos 14 días · {project.doneCount} terminadas en total → ver todas
                          </button>
                        )}
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
            {aviso && <Alert variant={aviso.startsWith('⚠') || aviso.includes('no se pudo') ? 'warning' : 'success'} dismissible onClose={() => setAviso('')} className="py-2 small">{aviso}</Alert>}
            {sel.size > 0 && hasFeature('tareas.editar') && (
              <AccionesEnBloque tareas={tasks.filter((t) => sel.has(String(t.id)))} proyectos={[project]} equipo={equipo} sprints={sprints} limpiar={() => setSel(new Set())} hecho={(a) => { setAviso(a); void load(); }} />
            )}
            <DataTable model={tabla} allRows={tasks} rowKey={(t) => String(t.id)} empty="Ninguna tarea cumple el filtro." seleccion={hasFeature('tareas.editar') ? sel : undefined} onSeleccion={setSel} />
          </Card.Body>
        </Card>
      )}

      {nuevoSprint && project && (
        <SprintModal
          projectId={project.id}
          onClose={() => setNuevoSprint(false)}
          onSaved={() => setNuevoSprint(false)}
        />
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

interface Carril {
  key: string;
  label: string;
  sub?: string;
  user?: UserRefDto | null;
  tasks: TaskDto[];
}

/** Agrupa las tareas en carriles por persona o por épica (las que no tienen, al final en «Sin …»). */
function carrilesDe(tasks: TaskDto[], modo: 'assignee' | 'epic', epicas: TaskDto[]): Carril[] {
  const m = new Map<string, Carril>();
  if (modo === 'assignee') {
    for (const t of tasks) {
      const k = t.assignee ? String(t.assignee.id) : 'none';
      if (!m.has(k)) m.set(k, { key: k, label: t.assignee?.name ?? 'Sin asignar', user: t.assignee, tasks: [] });
      m.get(k)!.tasks.push(t);
    }
  } else {
    for (const t of tasks) {
      const k = t.parentId ? String(t.parentId) : 'none';
      if (!m.has(k)) {
        const ep = epicas.find((e) => e.id === t.parentId);
        m.set(k, { key: k, label: t.parentId ? (ep?.title ?? t.parentTitle ?? 'Épica') : 'Sin épica', sub: t.parentKey ?? undefined, tasks: [] });
      }
      m.get(k)!.tasks.push(t);
    }
  }
  return [...m.values()].sort((a, b) => (a.key === 'none' ? 1 : 0) - (b.key === 'none' ? 1 : 0) || b.tasks.length - a.tasks.length || a.label.localeCompare(b.label));
}
