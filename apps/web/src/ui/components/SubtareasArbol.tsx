import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Form, ProgressBar, Spinner } from 'react-bootstrap';
import { CheckCircleFill, ChevronDown, ChevronRight, Circle, Plus } from 'react-bootstrap-icons';
import type { ProjectDto, TaskDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { Avatar, PrioridadPill, Vence } from './tareas-ui';

interface Props {
  parent: TaskDto;
  project: ProjectDto;
  items: TaskDto[];
  puedeEditar: boolean;
  /** Algo cambió (estado, alta…): que el padre recargue. */
  onChanged: () => void;
  onError: (msg: string) => void;
}

/** Subtareas como árbol: se despliegan las que tienen hijas, se marcan hechas con un clic y se añaden en línea. */
export function SubtareasArbol({ parent, project, items, puedeEditar, onChanged, onError }: Props) {
  const hechas = items.filter((s) => s.status.category === 'DONE').length;
  const pct = items.length ? Math.round((hechas / items.length) * 100) : 0;
  return (
    <div className="subtree">
      {items.length > 0 && (
        <ProgressBar now={pct} variant={pct === 100 ? 'success' : undefined} className="sprint-progress mb-2" title={`${hechas} de ${items.length} hechas`} />
      )}
      {items.length === 0 && <div className="text-secondary small mb-2">Ninguna todavía.</div>}
      <ul className="subtree-list">
        {items.map((s) => <Nodo key={s.id} task={s} project={project} nivel={0} puedeEditar={puedeEditar} onChanged={onChanged} onError={onError} />)}
      </ul>
      {puedeEditar && <AltaRapida parent={parent} project={project} nivel={0} onCreated={onChanged} onError={onError} />}
    </div>
  );
}

function Nodo({ task, project, nivel, puedeEditar, onChanged, onError }: { task: TaskDto; project: ProjectDto; nivel: number; puedeEditar: boolean; onChanged: () => void; onError: (m: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [hijas, setHijas] = useState<TaskDto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [alta, setAlta] = useState(false);
  const done = task.status.category === 'DONE';
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

  return (
    <li className={`subtree-node ${done ? 'done' : ''}`}>
      <div className="subtree-row" style={{ paddingLeft: nivel * 22 }}>
        <button type="button" className={`subtree-caret ${tieneHijas || alta ? '' : 'invisible'}`} onClick={toggleAbrir} aria-label={abierto ? 'Plegar' : 'Desplegar'}>
          {abierto ? <ChevronDown /> : <ChevronRight />}
        </button>
        <button type="button" className="subtree-check" onClick={toggleHecha} disabled={!puedeEditar || busy} title={done ? 'Reabrir' : 'Marcar hecha'}>
          {busy ? <Spinner size="sm" animation="border" /> : done ? <CheckCircleFill className="text-success" /> : <Circle />}
        </button>
        <Link to={`/t/${task.key}`} className="subtree-title">
          <span className="task-key">{task.key}</span>
          <span className="title">{task.title}</span>
        </Link>
        {task.priority !== 'NORMAL' && <span className="hide-sm"><PrioridadPill p={task.priority} /></span>}
        {tieneHijas && <span className="small text-secondary text-nowrap hide-sm">{task.doneSubtaskCount}/{task.subtaskCount}</span>}
        <span className="small hide-sm"><Vence date={task.dueDate} done={done} /></span>
        <Avatar user={task.assignee} />
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
            hijas.map((h) => <Nodo key={h.id} task={h} project={project} nivel={nivel + 1} puedeEditar={puedeEditar} onChanged={() => { void cargar(true); onChanged(); }} onError={onError} />)
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
