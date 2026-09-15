import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type Priority,
  type ProjectDto,
  type SprintDto,
  type TaskDto,
  type TaskTemplateDto,
  type TaskType,
  type UserRefDto,
} from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { EditorTexto } from './EditorTexto';

interface Props {
  project: ProjectDto;
  /** Sprint preseleccionado (p. ej. al crear desde un sprint). */
  sprintId?: number | null;
  /** Si se da, la nueva tarea nace como hija (subtarea o hija de épica). */
  parent?: TaskDto | null;
  onClose: () => void;
  onCreated: (t: TaskDto) => void;
}

export function NuevaTareaModal({ project, parent, sprintId: sprintInicial, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('TASK');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [statusId, setStatusId] = useState<number>(project.statuses[0]?.id ?? 0);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');
  const [estimate, setEstimate] = useState('');
  const [etiquetasUsadas, setEtiquetasUsadas] = useState<string[]>([]);
  const [plantillas, setPlantillas] = useState<TaskTemplateDto[]>([]);
  const [plantillaId, setPlantillaId] = useState('');
  const [parentId, setParentId] = useState<string>(parent ? String(parent.id) : '');
  const [equipo, setEquipo] = useState<UserRefDto[]>([]);
  const [epicas, setEpicas] = useState<TaskDto[]>([]);
  const [sprints, setSprints] = useState<SprintDto[]>([]);
  const [sprintId, setSprintId] = useState<string>(sprintInicial ? String(sprintInicial) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    tareasGateway.directorio().then(setEquipo).catch(() => setEquipo([]));
    tareasGateway.sprints().then(setSprints).catch(() => setSprints([]));
    tareasGateway.etiquetas(project.id).then((ts) => setEtiquetasUsadas(ts.map((t) => t.tag))).catch(() => setEtiquetasUsadas([]));
    tareasGateway.plantillas(project.id).then(setPlantillas).catch(() => setPlantillas([]));
    if (!parent) {
      tareasGateway
        .tareas({ projectId: project.id, type: 'EPIC', includeDone: false, pageSize: 200 })
        .then((p) => setEpicas(p.items))
        .catch(() => setEpicas([]));
    }
  }, [project.id, parent]);

  function aplicarPlantilla(id: string) {
    setPlantillaId(id);
    const tpl = plantillas.find((p) => String(p.id) === id);
    if (!tpl) return;
    setTitle(tpl.title);
    setDescription(tpl.description);
    setType(tpl.type);
    setPriority(tpl.priority);
    setTags(tpl.tags.join(', '));
    setEstimate(tpl.estimate === null ? '' : String(tpl.estimate));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const tpl = plantillas.find((p) => String(p.id) === plantillaId);
      if (tpl && tpl.subtasks.length > 0 && !parent) {
        // Con subtareas: la API crea la tarea y sus hijas de una vez.
        const creada = await tareasGateway.usarPlantilla(tpl.id, {
          projectId: project.id,
          title,
          assigneeId: assigneeId ? Number(assigneeId) : null,
          sprintId: sprintId ? Number(sprintId) : null,
          dueDate: dueDate || null,
          parentId: parentId ? Number(parentId) : null,
        });
        const ajustada = description !== tpl.description || priority !== tpl.priority || type !== tpl.type || tags !== tpl.tags.join(', ') ? await tareasGateway.editarTarea(creada.id, { description, priority, type, statusId, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), estimate: estimate === '' ? null : Number(estimate) }) : creada;
        onCreated(ajustada);
        return;
      }
      const t = await tareasGateway.crearTarea({
        projectId: project.id,
        title,
        description,
        type,
        priority,
        statusId,
        assigneeId: assigneeId ? Number(assigneeId) : null,
        parentId: parentId ? Number(parentId) : null,
        sprintId: sprintId ? Number(sprintId) : null,
        dueDate: dueDate || null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        estimate: estimate === '' ? null : Number(estimate),
      });
      onCreated(t);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal show onHide={onClose} size="lg" centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title>
            {parent ? `Nueva subtarea de ${parent.key}` : `Nueva tarea en ${project.name}`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">⚠ {error}</Alert>}
          {plantillas.length > 0 && (
            <Form.Group className="mb-3">
              <Form.Label className="small">Plantilla</Form.Label>
              <Form.Select id="nt-tpl" value={plantillaId} onChange={(e) => aplicarPlantilla(e.target.value)}>
                <option value="">Sin plantilla</option>
                {plantillas.map((p) => <option key={p.id} value={p.id}>{p.name}{p.subtasks.length ? ` (${p.subtasks.length} subtareas)` : ''}</option>)}
              </Form.Select>
            </Form.Group>
          )}
          <Form.Group className="mb-3">
            <Form.Label className="small">Título</Form.Label>
            <Form.Control id="nt-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Qué hay que hacer" />
          </Form.Group>
          <div className="row g-3">
            <div className="col-md-3">
              <Form.Label className="small">Tipo</Form.Label>
              <Form.Select id="nt-type" value={type} onChange={(e) => setType(e.target.value as TaskType)}>
                {TASK_TYPES.filter((t) => !parent || t !== 'EPIC').map((t) => (
                  <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="small">Prioridad</Form.Label>
              <Form.Select id="nt-prio" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="small">Estado</Form.Label>
              <Form.Select id="nt-status" value={statusId} onChange={(e) => setStatusId(Number(e.target.value))}>
                {project.statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="small">Vence</Form.Label>
              <Form.Control id="nt-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="col-md-6">
              <Form.Label className="small">Asignar a</Form.Label>
              <Form.Select id="nt-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Sin asignar</option>
                {equipo.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-8">
              <Form.Label className="small">Etiquetas</Form.Label>
              <Form.Control id="nt-tags" list="nt-tags-list" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="separadas por comas" />
              <datalist id="nt-tags-list">{etiquetasUsadas.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div className="col-md-4">
              <Form.Label className="small">Puntos</Form.Label>
              <Form.Control id="nt-estimate" type="number" min={0} max={999} value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="sin estimar" />
            </div>
            <div className="col-md-6">
              <Form.Label className="small">Sprint</Form.Label>
              <Form.Select id="nt-sprint" value={sprintId} onChange={(e) => setSprintId(e.target.value)}>
                <option value="">Backlog (sin sprint)</option>
                {sprints.map((sp) => (
                  <option key={sp.id} value={sp.id}>{sp.name}{sp.status === 'ACTIVE' ? ' · en curso' : ''}</option>
                ))}
              </Form.Select>
            </div>
            {!parent && type !== 'EPIC' && (
              <div className="col-md-6">
                <Form.Label className="small">Épica</Form.Label>
                <Form.Select id="nt-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">Ninguna</option>
                  {epicas.map((ep) => (
                    <option key={ep.id} value={ep.id}>{ep.key} · {ep.title}</option>
                  ))}
                </Form.Select>
              </div>
            )}
          </div>
          <Form.Group className="mt-3">
            <Form.Label className="small">Descripción</Form.Label>
            <EditorTexto id="nt-desc" value={description} onChange={setDescription} minHeight={160} placeholder="Contexto, pasos, criterios de aceptación…" />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" className="btn-brand" disabled={saving || !title.trim()}>
            {saving ? <Spinner as="span" size="sm" animation="border" /> : 'Crear tarea'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
