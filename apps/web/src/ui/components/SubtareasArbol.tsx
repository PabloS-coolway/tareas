import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Dropdown, Form, ProgressBar, Spinner } from 'react-bootstrap';
import { DragDropContext, Draggable, Droppable, type DraggableProvided, type DropResult } from '@hello-pangea/dnd';
import { CheckCircleFill, ChevronDown, ChevronRight, Circle, DashCircleFill, GripVertical, Plus } from 'react-bootstrap-icons';
import type { ProjectDto, TaskDto, UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { estaBloqueada, moverEnLista, ordenarSubtareas, resumirSubtareas } from '../../domain/subtareas';
import { Avatar, PrioridadPill, Vence } from './tareas-ui';

interface Props {
  parent: TaskDto;
  project: ProjectDto;
  items: TaskDto[];
  /** Para asignar desde la lista, sin entrar en la tarea. */
  equipo: UserRefDto[];
  puedeEditar: boolean;
  /** Algo cambió (estado, alta…): que el padre recargue. */
  onChanged: () => void;
  onError: (msg: string) => void;
}

/**
 * Subtareas como árbol: se despliegan las que tienen hijas, se marcan hechas con un clic, se asignan desde el
 * avatar, se ordenan arrastrando por el asa (primer nivel; el orden se guarda para todos) y se añaden en línea.
 */
export function SubtareasArbol({ parent, project, items, equipo, puedeEditar, onChanged, onError }: Props) {
  // Copia local para que el arrastre se vea al momento; se rehace cuando el padre recarga.
  const [lista, setLista] = useState(() => ordenarSubtareas(items));
  useEffect(() => setLista(ordenarSubtareas(items)), [items]);
  const { total, hechas, bloqueadas } = resumirSubtareas(items);
  const pct = (n: number) => (total ? (n / total) * 100 : 0);

  /** Se ve al momento; si no se puede guardar, vuelve a como estaba. */
  async function onDragEnd({ source, destination }: DropResult) {
    if (!destination || destination.index === source.index) return;
    const antes = lista;
    const nueva = moverEnLista(lista, source.index, destination.index);
    setLista(nueva);
    try {
      await tareasGateway.ordenarSubtareas(parent.id, nueva.map((t) => t.id));
      onChanged();
    } catch (e) {
      setLista(antes);
      onError((e as Error).message);
    }
  }

  return (
    <div className="subtree">
      {total > 0 && (
        <ProgressBar className="sprint-progress mb-2" title={`${hechas} de ${total} hechas${bloqueadas ? ` · ${bloqueadas} bloqueada${bloqueadas === 1 ? '' : 's'}` : ''}`}>
          <ProgressBar now={pct(hechas)} variant={hechas === total ? 'success' : undefined} key="hechas" />
          {bloqueadas > 0 && <ProgressBar now={pct(bloqueadas)} variant="danger" key="bloqueadas" />}
        </ProgressBar>
      )}
      {items.length === 0 && <div className="text-secondary small mb-2">Ninguna todavía.</div>}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId={`subtareas-${parent.id}`} isDropDisabled={!puedeEditar}>
          {(prov) => (
            <ul ref={prov.innerRef} {...prov.droppableProps} className="subtree-list">
              {lista.map((s, i) => (
                <Draggable key={s.id} draggableId={String(s.id)} index={i} isDragDisabled={!puedeEditar || lista.length < 2}>
                  {(dp, ds) => <Nodo task={s} project={project} equipo={equipo} nivel={0} puedeEditar={puedeEditar} drag={dp} arrastrando={ds.isDragging} onChanged={onChanged} onError={onError} />}
                </Draggable>
              ))}
              {prov.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
      {puedeEditar && <AltaRapida parent={parent} project={project} nivel={0} onCreated={onChanged} onError={onError} />}
    </div>
  );
}

interface NodoProps {
  task: TaskDto;
  project: ProjectDto;
  equipo: UserRefDto[];
  nivel: number;
  puedeEditar: boolean;
  /** Sólo en el primer nivel: lo que pone el arrastre (fila y asa). */
  drag?: DraggableProvided;
  arrastrando?: boolean;
  onChanged: () => void;
  onError: (m: string) => void;
}

function Nodo({ task, project, equipo, nivel, puedeEditar, drag, arrastrando, onChanged, onError }: NodoProps) {
  const [abierto, setAbierto] = useState(false);
  const [hijas, setHijas] = useState<TaskDto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [alta, setAlta] = useState(false);
  const done = task.status.category === 'DONE';
  const bloqueada = estaBloqueada(task);
  const tieneHijas = task.subtaskCount > 0;

  async function cargar(force = false) {
    if (hijas && !force) return;
    try {
      setHijas(await tareasGateway.subtareas(task.id));
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function toggleAbrir() {
    const next = !abierto;
    setAbierto(next);
    if (next) await cargar();
  }

  /** Un clic en el círculo: hecha ↔ reabierta (primer estado "por hacer" del proyecto). */
  async function toggleHecha() {
    if (!puedeEditar) return;
    const destino = done ? project.statuses.find((s) => s.category === 'TODO') : project.statuses.find((s) => s.category === 'DONE');
    if (!destino) {
      onError('El proyecto no tiene un estado adecuado.');
      return;
    }
    setBusy(true);
    try {
      await tareasGateway.editarTarea(task.id, { statusId: destino.id });
      onChanged();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function asignar(assigneeId: number | null) {
    if (assigneeId === (task.assignee?.id ?? null)) return;
    setBusy(true);
    try {
      await tareasGateway.editarTarea(task.id, { assigneeId });
      onChanged();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li ref={drag?.innerRef} {...drag?.draggableProps} className={`subtree-node ${done ? 'done' : ''} ${bloqueada ? 'bloqueada' : ''} ${arrastrando ? 'dragging' : ''}`}>
      <div className="subtree-row" style={{ paddingLeft: nivel * 22 }}>
        {drag && puedeEditar && (
          <span {...drag.dragHandleProps} className="subtree-grip" title="Arrastra para ordenar" aria-label="Arrastra para ordenar">
            <GripVertical />
          </span>
        )}
        <button type="button" className={`subtree-caret ${tieneHijas || alta ? '' : 'invisible'}`} onClick={toggleAbrir} aria-label={abierto ? 'Plegar' : 'Desplegar'}>
          {abierto ? <ChevronDown /> : <ChevronRight />}
        </button>
        <button type="button" className="subtree-check" onClick={toggleHecha} disabled={!puedeEditar || busy} title={done ? 'Reabrir' : 'Marcar hecha'}>
          {busy ? <Spinner size="sm" animation="border" /> : done ? <CheckCircleFill className="text-success" /> : bloqueada ? <DashCircleFill className="text-danger" /> : <Circle />}
        </button>
        <Link to={`/t/${task.key}`} className="subtree-title">
          <span className="task-key">{task.key}</span>
          <span className="title">{task.title}</span>
        </Link>
        {bloqueada && (
          <span className="pill blocked" title={task.blockedByOpenCount > 0 ? `Esperando a ${task.blockedByOpenCount} tarea(s) sin terminar` : `Estado: ${task.status.name}`}>
            ⛔ Bloqueada
          </span>
        )}
        {task.priority !== 'NORMAL' && <span className="hide-sm"><PrioridadPill p={task.priority} /></span>}
        {tieneHijas && <span className="small text-secondary text-nowrap hide-sm">{task.doneSubtaskCount}/{task.subtaskCount}</span>}
        <span className="small hide-sm"><Vence date={task.dueDate} done={done} /></span>
        {puedeEditar ? (
          <Dropdown align="end" onSelect={(k) => void asignar(k === 'none' ? null : Number(k))}>
            <Dropdown.Toggle as="button" type="button" className="subtree-asignar" disabled={busy} title={`${task.assignee?.name ?? 'Sin asignar'} · cambiar`}>
              <Avatar user={task.assignee} title="" />
            </Dropdown.Toggle>
            <Dropdown.Menu className="subtree-asignar-menu" popperConfig={{ strategy: 'fixed' }}>
              <Dropdown.Item eventKey="none" active={!task.assignee}>Sin asignar</Dropdown.Item>
              <Dropdown.Divider />
              {equipo.map((u) => (
                <Dropdown.Item key={u.id} eventKey={String(u.id)} active={task.assignee?.id === u.id} className="d-flex align-items-center gap-2">
                  <Avatar user={u} title="" /> {u.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        ) : (
          <Avatar user={task.assignee} />
        )}
        {puedeEditar && nivel < 2 && (
          <Button size="sm" variant="link" className="subtree-add p-0" title="Añadir subtarea aquí" onClick={async () => { setAlta(true); setAbierto(true); await cargar(); }}>
            <Plus />
          </Button>
        )}
      </div>
      {abierto && (
        <ul className="subtree-list">
          {hijas === null ? (
            <li className="small text-secondary" style={{ paddingLeft: (nivel + 1) * 22 + 8 }}><Spinner size="sm" animation="border" /> cargando…</li>
          ) : (
            ordenarSubtareas(hijas).map((h) => <Nodo key={h.id} task={h} project={project} equipo={equipo} nivel={nivel + 1} puedeEditar={puedeEditar} onChanged={() => { void cargar(true); onChanged(); }} onError={onError} />)
          )}
          {alta && (
            <AltaRapida
              parent={task}
              project={project}
              nivel={nivel + 1}
              autoFocus
              onCreated={() => { void cargar(true); onChanged(); }}
              onCancel={() => setAlta(false)}
              onError={onError}
            />
          )}
        </ul>
      )}
    </li>
  );
}

/** Alta en línea: título y Enter. */
function AltaRapida({ parent, project, nivel, autoFocus, onCreated, onCancel, onError }: { parent: TaskDto; project: ProjectDto; nivel: number; autoFocus?: boolean; onCreated: () => void; onCancel?: () => void; onError: (m: string) => void }) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    try {
      await tareasGateway.crearTarea({ projectId: project.id, title: t, parentId: parent.id, sprintId: parent.sprintId ?? null });
      setTitle('');
      onCreated();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form onSubmit={submit} className="subtree-alta" style={{ paddingLeft: nivel * 22 }}>
      <Plus className="text-secondary" />
      <Form.Control
        size="sm"
        autoFocus={autoFocus}
        value={title}
        placeholder={nivel === 0 ? 'Nueva subtarea… (Enter para crear)' : `Subtarea de ${parent.key}…`}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel?.()}
        disabled={saving}
      />
      {saving && <Spinner size="sm" animation="border" />}
    </Form>
  );
}
