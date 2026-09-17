import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { ChevronDown, ChevronRight, Plus } from 'react-bootstrap-icons';
import type { SprintDto, TaskDto, UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { Avatar, EstadoPill, Etiquetas, PrioridadPill, Puntos, Vence } from '../components/tareas-ui';
import { Skeleton } from '../components/Skeleton';
import { useProyectos } from '../proyectos/ProyectosContext';
import { SprintAmbito, SprintBadge, SprintModal, rangoSprint } from './SprintsPage';
import { CerrarSprintModal } from './SprintPage';

const PRIO: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

/** Planificación: sprints abiertos arriba, backlog abajo; arrastra o selecciona y mueve. */
export function BacklogPage() {
  const { hasFeature } = useAuth();
  const { proyectos } = useProyectos();
  const puede = hasFeature('tareas.editar');
  const [sprints, setSprints] = useState<SprintDto[] | null>(null);
  const [tareas, setTareas] = useState<TaskDto[] | null>(null); // abiertas (todas, con y sin sprint)
  const [equipo, setEquipo] = useState<UserRefDto[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assignee, setAssignee] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [plegados, setPlegados] = useState<Set<number>>(new Set());
  const [nuevo, setNuevo] = useState(false);
  const [cerrar, setCerrar] = useState<SprintDto | null>(null);
  /** Proyecto de la tarea que se está arrastrando: los sprints de OTRO proyecto se cierran al soltar. */
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const admite = (s: SprintDto, projectIds: number[]) => !s.projectId || projectIds.every((p) => p === s.projectId);

  const load = useCallback(async () => {
    setError('');
    try {
      const [ss, p] = await Promise.all([
        tareasGateway.sprints(),
        tareasGateway.tareas({
          board: true,
          projectId: projectId ? Number(projectId) : undefined,
          assigneeId: assignee === 'me' || assignee === 'none' ? assignee : assignee ? Number(assignee) : undefined,
          q: q || undefined,
          pageSize: 1000,
        }),
      ]);
      setSprints(ss);
      setTareas(p.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [projectId, assignee, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    tareasGateway.directorio().then(setEquipo).catch(() => setEquipo([]));
  }, []);

  const ordenar = (ts: TaskDto[]) => [...ts].sort((a, b) => PRIO[a.priority] - PRIO[b.priority] || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9') || a.id - b.id);
  const porSprint = useMemo(() => {
    const m = new Map<number, TaskDto[]>();
    for (const t of tareas ?? []) if (t.sprintId) m.set(t.sprintId, [...(m.get(t.sprintId) ?? []), t]);
    return m;
  }, [tareas]);
  const backlog = useMemo(() => ordenar((tareas ?? []).filter((t) => !t.sprintId && t.status.category !== 'DONE')), [tareas]);
  const orden = (sprints ?? []).slice().sort((a, b) => (a.status === 'ACTIVE' ? 0 : 1) - (b.status === 'ACTIVE' ? 0 : 1) || (a.startDate ?? '9').localeCompare(b.startDate ?? '9'));

  async function mover(ids: number[], sprintId: number | null) {
    if (!ids.length) return;
    setBusy(true);
    const antes = tareas;
    setTareas((ts) => (ts ?? []).map((t) => (ids.includes(t.id) ? { ...t, sprintId, sprintName: sprintId ? (sprints?.find((s) => s.id === sprintId)?.name ?? null) : null } : t)));
    try {
      for (const id of ids) await tareasGateway.editarTarea(id, { sprintId });
      setSel(new Set());
      await load();
    } catch (e) {
      setTareas(antes);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDragEnd(r: DropResult) {
    setArrastrando(null);
    const { destination, draggableId } = r;
    if (!destination) return;
    const dest = destination.droppableId === 'backlog' ? null : Number(destination.droppableId.replace('sprint-', ''));
    const id = Number(draggableId);
    const t = tareas?.find((x) => x.id === id);
    if (!t || (t.sprintId ?? null) === dest) return;
    const ids = sel.has(id) ? [...sel] : [id];
    await mover(ids, dest);
  }

  async function activar(s: SprintDto) {
    setBusy(true);
    try {
      await tareasGateway.editarSprint(s.id, { status: s.status === 'ACTIVE' ? 'PLANNED' : 'ACTIVE' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: number) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const togglePlegado = (id: number) => setPlegados((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const fila = (t: TaskDto, i: number) => (
    <Draggable key={t.id} draggableId={String(t.id)} index={i} isDragDisabled={!puede}>
      {(dp, ds) => (
        <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps} className={`backlog-row ${sel.has(t.id) ? 'sel' : ''} ${ds.isDragging ? 'dragging' : ''}`}>
          {puede ? <Form.Check type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} onClick={(e) => e.stopPropagation()} /> : <span />}
          <span className="task-key">{t.key}</span>
          <Link to={`/t/${t.key}`} className="title text-decoration-none text-reset">
            {t.title}
            {t.tags.length > 0 && <span className="ms-2 hide-sm"><Etiquetas tags={t.tags} max={2} /></span>}
          </Link>
          <span className="hide-sm d-inline-flex align-items-center gap-1"><EstadoPill s={t.status} />{t.priority !== 'NORMAL' && <PrioridadPill p={t.priority} />}<Puntos n={t.estimate} /></span>
          <span className="small hide-sm"><Vence date={t.dueDate} done={t.status.category === 'DONE'} /></span>
          <Avatar user={t.assignee} />
        </div>
      )}
    </Draggable>
  );

  const puntos = (ts: TaskDto[]) => ts.reduce((n, t) => n + (t.estimate ?? 0), 0);

  return (
    <div className="page page-board">
      <header className="page-head mb-3 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-0">Planificación {busy && <Spinner as="span" size="sm" animation="border" />}</h1>
          <div className="small text-secondary">Arrastra tareas del backlog a un sprint (o marca varias y usa «Mover a»). Activa el sprint cuando empiece y ciérralo al acabar.</div>
        </div>
        {puede && <Button size="sm" className="btn-brand" onClick={() => setNuevo(true)}><Plus /> Nuevo sprint</Button>}
      </header>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}

      <div className="board-toolbar">
        <Form.Control size="sm" className="grow" placeholder="Buscar por título o clave…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Form.Select size="sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {proyectos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Form.Select>
        <Form.Select size="sm" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Cualquier asignado</option>
          <option value="me">Mías</option>
          <option value="none">Sin asignar</option>
          {equipo.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Form.Select>
        {sel.size > 0 && (
          <div className="d-flex align-items-center gap-2 ms-auto">
            <span className="small fw-semibold">{sel.size} seleccionadas ·</span>
            <Form.Select size="sm" value="" onChange={(e) => { const v = e.target.value; if (v) void mover([...sel], v === 'backlog' ? null : Number(v)); }}>
              <option value="">Mover a…</option>
              {orden.filter((s) => admite(s, (tareas ?? []).filter((t) => sel.has(t.id)).map((t) => t.projectId))).map((s) => <option key={s.id} value={s.id}>{s.name}{s.projectKey ? ` · ${s.projectKey}` : ''}</option>)}
              <option value="backlog">Backlog</option>
            </Form.Select>
            <Button size="sm" variant="link" className="p-0" onClick={() => setSel(new Set())}>quitar selección</Button>
          </div>
        )}
      </div>

      {!sprints || !tareas ? (
        <Skeleton className="skeleton-rounded" width="100%" height={300} />
      ) : (
        <DragDropContext onDragEnd={onDragEnd} onDragStart={(s) => setArrastrando(tareas?.find((t) => t.id === Number(s.draggableId))?.projectId ?? null)}>
          {orden.map((s) => {
            const ts = ordenar(porSprint.get(s.id) ?? []);
            const hechas = ts.filter((t) => t.status.category === 'DONE').length;
            const plegado = plegados.has(s.id);
            return (
              <Card key={s.id} className={`mb-3 sprint-card ${s.status === 'ACTIVE' ? 'active' : ''}`}>
                <Card.Body className="p-3">
                  <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                    <button type="button" className="subtree-caret" onClick={() => togglePlegado(s.id)} aria-label={plegado ? 'Desplegar' : 'Plegar'}>{plegado ? <ChevronRight /> : <ChevronDown />}</button>
                    <Link to={`/sprints/${s.id}`} className="fw-bold text-decoration-none">{s.name}</Link>
                    <SprintBadge s={s} />
                    <SprintAmbito s={s} />
                    <span className="small text-secondary">{rangoSprint(s)} · {ts.length} tareas{hechas > 0 && <>, {hechas} hechas</>}{puntos(ts) > 0 && <> · {puntos(ts)} pt</>}</span>
                    {puede && (
                      <span className="ms-auto d-flex gap-2">
                        <Button size="sm" variant="outline-secondary" disabled={busy} onClick={() => activar(s)}>{s.status === 'ACTIVE' ? 'Pausar' : 'Activar'}</Button>
                        <Button size="sm" variant="outline-danger" onClick={() => setCerrar(s)}>Cerrar</Button>
                      </span>
                    )}
                  </div>
                  {s.goal && <div className="small text-secondary sprint-goal mb-2 ps-4">{s.goal}</div>}
                  {!plegado && (
                    <Droppable droppableId={`sprint-${s.id}`} isDropDisabled={!puede || (arrastrando !== null && !admite(s, [arrastrando]))}>
                      {(prov, snap) => (
                        <div ref={prov.innerRef} {...prov.droppableProps} className={`backlog-list dropzone ${snap.isDraggingOver ? 'over' : ''} ${arrastrando !== null && !admite(s, [arrastrando]) ? 'no-admite' : ''}`}>
                          {ts.map(fila)}
                          {prov.placeholder}
                          {ts.length === 0 && !snap.isDraggingOver && <div className="small text-secondary py-2 px-1">{s.projectId ? `Sprint vacío: arrastra tareas de ${s.projectName ?? s.projectKey} aquí.` : 'Sprint vacío: arrastra tareas aquí.'}</div>}
                        </div>
                      )}
                    </Droppable>
                  )}
                </Card.Body>
              </Card>
            );
          })}
          {orden.length === 0 && <Card className="mb-3"><Card.Body className="text-secondary">No hay sprints abiertos. Crea uno y arrastra tareas del backlog.</Card.Body></Card>}
          <div className="small text-secondary mb-3 text-end"><Link to="/sprints?cerrados=1">Ver sprints cerrados</Link> (con lo que se terminó en cada uno)</div>

          <Card>
            <Card.Body className="p-3">
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="fw-bold">Backlog</span>
                <span className="small text-secondary">{backlog.length} tareas abiertas sin sprint{puntos(backlog) > 0 && <> · {puntos(backlog)} pt</>} · por prioridad y fecha</span>
                {puede && backlog.length > 0 && (
                  <Button size="sm" variant="link" className="ms-auto p-0" onClick={() => setSel(new Set(backlog.map((t) => t.id)))}>seleccionar todo</Button>
                )}
              </div>
              <Droppable droppableId="backlog" isDropDisabled={!puede}>
                {(prov, snap) => (
                  <div ref={prov.innerRef} {...prov.droppableProps} className={`backlog-list dropzone ${snap.isDraggingOver ? 'over' : ''}`}>
                    {backlog.map(fila)}
                    {prov.placeholder}
                    {backlog.length === 0 && <div className="small text-secondary py-2 px-1">Backlog vacío con estos filtros.</div>}
                  </div>
                )}
              </Droppable>
            </Card.Body>
          </Card>
        </DragDropContext>
      )}

      {nuevo && (
        <SprintModal
          projectId={projectId ? Number(projectId) : null}
          onClose={() => setNuevo(false)}
          onSaved={() => {
            setNuevo(false);
            void load();
          }}
        />
      )}
      {cerrar && (
        <CerrarSprintModal
          sprint={cerrar}
          abiertas={(porSprint.get(cerrar.id) ?? []).filter((t) => t.status.category !== 'DONE').length}
          onClose={() => setCerrar(null)}
          onDone={() => {
            setCerrar(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
