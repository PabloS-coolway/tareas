import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { BoxArrowUpRight, Files, JournalText, Paperclip, Plus, Trash } from 'react-bootstrap-icons';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  RECURRENCES,
  RECURRENCE_LABELS,
  type Recurrence,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type ActivityDto,
  type AttachmentDto,
  type CommentDto,
  type Priority,
  type ProjectDto,
  type TaskDto,
  type TaskType,
  type UpdateTaskDto,
  type UserRefDto,
  type SprintDto,
} from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { Avatar, Etiquetas, TipoPill, fmtFechaHora, hace } from '../components/tareas-ui';
import { NuevaTareaModal } from '../components/NuevaTareaModal';
import { Skeleton } from '../components/Skeleton';
import { Markdown } from '../components/Markdown';
import { SubtareasArbol } from '../components/SubtareasArbol';
import { ActividadTexto } from '../components/ActividadTexto';
import { Dependencias } from '../components/Dependencias';
import { ComentarioInput } from '../components/ComentarioInput';
import { EditorTexto } from '../components/EditorTexto';

const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export function TareaPage() {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const { user, hasFeature } = useAuth();
  const puedeEditar = hasFeature('tareas.editar');

  const [task, setTask] = useState<TaskDto | null>(null);
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [subtareas, setSubtareas] = useState<TaskDto[]>([]);
  const [comentarios, setComentarios] = useState<CommentDto[]>([]);
  const [adjuntos, setAdjuntos] = useState<AttachmentDto[]>([]);
  const [actividad, setActividad] = useState<ActivityDto[]>([]);
  const [equipo, setEquipo] = useState<UserRefDto[]>([]);
  const [epicas, setEpicas] = useState<TaskDto[]>([]);
  const [sprints, setSprints] = useState<SprintDto[]>([]);
  const [etiquetasUsadas, setEtiquetasUsadas] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [editandoDesc, setEditandoDesc] = useState(false);
  const [tags, setTags] = useState('');
  const [comentario, setComentario] = useState('');
  const [nuevaSub, setNuevaSub] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const t = await tareasGateway.tarea(key);
      setTask(t);
      setTitle(t.title);
      setDesc(t.description);
      setTags(t.tags.join(', '));
      const [p, subs, cs, as, act] = await Promise.all([
        tareasGateway.proyecto(String(t.projectId)),
        tareasGateway.subtareas(t.id),
        tareasGateway.comentarios(t.id),
        tareasGateway.adjuntos(t.id),
        tareasGateway.actividad(t.id),
      ]);
      setProject(p);
      setSubtareas(subs);
      setComentarios(cs);
      setAdjuntos(as);
      setActividad(act);
      if (t.type !== 'EPIC') {
        tareasGateway.tareas({ projectId: t.projectId, type: 'EPIC', includeDone: true, pageSize: 200 }).then((pg) => setEpicas(pg.items)).catch(() => setEpicas([]));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [key]);

  useEffect(() => {
    setTask(null);
    void load();
  }, [load]);

  useEffect(() => {
    tareasGateway.directorio().then(setEquipo).catch(() => setEquipo([]));
    tareasGateway.sprints().then(setSprints).catch(() => setSprints([]));
    tareasGateway.etiquetas().then((ts) => setEtiquetasUsadas(ts.map((t) => t.tag))).catch(() => setEtiquetasUsadas([]));
  }, []);

  async function guardar(dto: UpdateTaskDto) {
    if (!task) return;
    setError('');
    setSaving(true);
    try {
      const t = await tareasGateway.editarTarea(task.id, dto);
      setTask(t);
      setTitle(t.title);
      setDesc(t.description);
      setTags(t.tags.join(', '));
      setActividad(await tareasGateway.actividad(t.id));
      if (t.key !== key) navigate(`/t/${t.key}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function comentar(e: FormEvent) {
    e.preventDefault();
    if (!task || !comentario.trim()) return;
    try {
      const c = await tareasGateway.comentar(task.id, comentario);
      setComentarios((cs) => [...cs, c]);
      setComentario('');
      setTask({ ...task, commentCount: task.commentCount + 1 });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function borrarComentario(c: CommentDto) {
    if (!window.confirm('¿Borrar este comentario?')) return;
    try {
      await tareasGateway.borrarComentario(c.id);
      setComentarios((cs) => cs.filter((x) => x.id !== c.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function subir(files: FileList | null) {
    if (!task || !files?.length) return;
    setError('');
    for (const f of Array.from(files)) {
      try {
        const a = await tareasGateway.subirAdjunto(task.id, f);
        setAdjuntos((as) => [...as, a]);
      } catch (err) {
        setError((err as Error).message);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function borrarAdjunto(a: AttachmentDto) {
    if (!window.confirm(`¿Borrar "${a.filename}"?`)) return;
    try {
      await tareasGateway.borrarAdjunto(a.id);
      setAdjuntos((as) => as.filter((x) => x.id !== a.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function guardarPlantilla() {
    if (!task) return;
    const name = window.prompt('Nombre de la plantilla:', task.title);
    if (!name?.trim()) return;
    const global = window.confirm('¿Disponible para todos los proyectos? (Cancelar = sólo para este proyecto)');
    try {
      await tareasGateway.plantillaDesdeTarea(task.id, name.trim(), global);
      setNotice(`Plantilla "${name.trim()}" guardada. La verás al crear una tarea, en «Plantilla».`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function duplicarTarea() {
    if (!task) return;
    try {
      const copia = await tareasGateway.duplicarTarea(task.id);
      navigate(`/t/${copia.key}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function borrarTarea() {
    if (!task || !window.confirm(`¿Borrar ${task.key} "${task.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await tareasGateway.borrarTarea(task.id);
      navigate(`/p/${task.projectKey}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!task || !project) {
    return (
      <div className="page page-full">
        {error ? <Alert variant="danger">⚠ {error}</Alert> : <Skeleton className="skeleton-rounded" width="100%" height={320} />}
      </div>
    );
  }

  const done = task.status.category === 'DONE';

  return (
    <div className="page page-full">
      <div className="small text-secondary mb-2 d-flex align-items-center gap-2 flex-wrap">
        <Link to={`/p/${task.projectKey}`} className="text-decoration-none">{project.name}</Link>
        {task.parentKey && (
          <>
            <span>/</span>
            <Link to={`/t/${task.parentKey}`} className="text-decoration-none">{task.parentKey} · {task.parentTitle}</Link>
          </>
        )}
        <span>/</span>
        <span className="task-key big">{task.key}</span>
        <TipoPill t={task.type} />
        {saving && <Spinner as="span" size="sm" animation="border" />}
        {task.clickupUrl && (
          <a href={task.clickupUrl} target="_blank" rel="noreferrer" className="ms-auto small">ver en ClickUp <BoxArrowUpRight /></a>
        )}
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}
      {notice && <Alert variant="success" dismissible onClose={() => setNotice('')}>{notice}</Alert>}

      <div className="tarea-layout">
        <div>
          <input
            id="t-title"
            className="tarea-title mb-2"
            value={title}
            readOnly={!puedeEditar}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && guardar({ title })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />

          <Card className="mb-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Card.Title className="mb-0">Descripción</Card.Title>
                {editandoDesc && (
                  <div className="d-flex gap-2 align-items-center">
                    <Button size="sm" variant="outline-secondary" onClick={() => { setDesc(task.description); setEditandoDesc(false); }}>Cancelar</Button>
                    <Button size="sm" className="btn-brand" onClick={async () => { await guardar({ description: desc }); setEditandoDesc(false); }}>Guardar</Button>
                  </div>
                )}
              </div>
              {editandoDesc ? (
                <EditorTexto id="t-desc" value={desc} onChange={setDesc} autoFocus placeholder="Contexto, pasos, criterios de aceptación…" />
              ) : (
                <div className={`tarea-desc-view ${task.description ? '' : 'empty'}`} onClick={() => puedeEditar && setEditandoDesc(true)}>
                  {task.description ? <Markdown text={task.description} /> : puedeEditar ? 'Sin descripción. Haz clic para escribir.' : 'Sin descripción.'}
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Card.Title className="mb-0">
                  {task.type === 'EPIC' ? 'Tareas de la épica' : 'Subtareas'}
                  {subtareas.length > 0 && <span className="text-secondary fw-normal small ms-2">{subtareas.filter((s) => s.status.category === 'DONE').length}/{subtareas.length} hechas</span>}
                </Card.Title>
                {puedeEditar && <Button size="sm" variant="outline-secondary" onClick={() => setNuevaSub(true)}><Plus /> Añadir</Button>}
              </div>
              <SubtareasArbol parent={task} project={project} items={subtareas} puedeEditar={puedeEditar} onChanged={() => void load()} onError={setError} />
            </Card.Body>
          </Card>

          <Dependencias task={task} puedeEditar={puedeEditar} onChanged={() => void load()} onError={setError} />

          <Card className="mb-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Card.Title className="mb-0">Adjuntos <span className="text-secondary fw-normal small">{adjuntos.length}</span></Card.Title>
                {puedeEditar && (
                  <>
                    <input ref={fileRef} type="file" multiple hidden onChange={(e) => subir(e.target.files)} />
                    <Button size="sm" variant="outline-secondary" onClick={() => fileRef.current?.click()}><Paperclip /> Subir</Button>
                  </>
                )}
              </div>
              {adjuntos.length === 0 ? (
                <div className="text-secondary small">Sin adjuntos. Capturas, PDFs… hasta 15 MB.</div>
              ) : (
                adjuntos.map((a) => (
                  <div key={a.id} className="adjunto">
                    <Paperclip className="text-secondary" />
                    <button type="button" className="btn btn-link p-0 name text-start" onClick={() => tareasGateway.descargarAdjunto(a).catch((e) => setError((e as Error).message))}>{a.filename}</button>
                    <span className="size">{fmtBytes(a.size)}</span>
                    <span className="small text-secondary">{a.uploader.name} · {hace(a.createdAt)}</span>
                    {puedeEditar && <Button size="sm" variant="link" className="text-danger p-0" title="Borrar" onClick={() => borrarAdjunto(a)}><Trash /></Button>}
                  </div>
                ))
              )}
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Body>
              <Card.Title className="mb-2">Comentarios <span className="text-secondary fw-normal small">{comentarios.length}</span></Card.Title>
              {comentarios.map((c) => (
                <div key={c.id} className="comment">
                  <Avatar user={c.author} />
                  <div className="flex-grow-1">
                    <div className="head">
                      <b>{c.author.name}</b>
                      <span title={fmtFechaHora(c.createdAt)}>{hace(c.createdAt)}</span>
                      {(c.author.id === user?.id || user?.role === 'admin') && (
                        <button type="button" className="btn btn-link btn-sm p-0 ms-auto text-danger" title="Borrar" onClick={() => borrarComentario(c)}><Trash /></button>
                      )}
                    </div>
                    <div className="body"><Markdown text={c.body} /></div>
                  </div>
                </div>
              ))}
              {puedeEditar && (
                <Form onSubmit={comentar} className="mt-3">
                  <ComentarioInput id="t-comment" value={comentario} onChange={setComentario} equipo={equipo} />
                  <div className="text-end mt-2">
                    <Button type="submit" size="sm" className="btn-brand" disabled={!comentario.trim()}>Comentar</Button>
                  </div>
                </Form>
              )}
            </Card.Body>
          </Card>
        </div>

        <aside className="tarea-side">
          <Card className="mb-3">
            <Card.Body>
              <div className="field">
                <label htmlFor="t-status">Estado</label>
                <Form.Select id="t-status" size="sm" value={task.status.id} disabled={!puedeEditar} onChange={(e) => guardar({ statusId: Number(e.target.value) })}>
                  {project.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Form.Select>
              </div>
              <div className="field">
                <label htmlFor="t-assignee">Asignado</label>
                <Form.Select id="t-assignee" size="sm" value={task.assignee?.id ?? ''} disabled={!puedeEditar} onChange={(e) => guardar({ assigneeId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Sin asignar</option>
                  {equipo.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Form.Select>
              </div>
              <div className="field">
                <label htmlFor="t-sprint">Sprint</label>
                <Form.Select id="t-sprint" size="sm" value={task.sprintId ?? ''} disabled={!puedeEditar} onChange={(e) => guardar({ sprintId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Backlog (sin sprint)</option>
                  {sprints.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}{sp.status === 'ACTIVE' ? ' · en curso' : ''}</option>)}
                  {task.sprintId && !sprints.some((sp) => sp.id === task.sprintId) && <option value={task.sprintId}>{task.sprintName} (cerrado)</option>}
                </Form.Select>
              </div>
              <div className="field">
                <label htmlFor="t-prio">Prioridad</label>
                <Form.Select id="t-prio" size="sm" value={task.priority} disabled={!puedeEditar} onChange={(e) => guardar({ priority: e.target.value as Priority })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                </Form.Select>
              </div>
              <div className="field">
                <label htmlFor="t-type">Tipo</label>
                <Form.Select id="t-type" size="sm" value={task.type} disabled={!puedeEditar} onChange={(e) => guardar({ type: e.target.value as TaskType })}>
                  {TASK_TYPES.map((t) => <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>)}
                </Form.Select>
              </div>
              <div className="field">
                <label htmlFor="t-due">Vence</label>
                <Form.Control id="t-due" size="sm" type="date" value={task.dueDate ?? ''} disabled={!puedeEditar} onChange={(e) => guardar({ dueDate: e.target.value || null })} />
              </div>
              <div className="field">
                <label htmlFor="t-start">Inicio</label>
                <Form.Control id="t-start" size="sm" type="date" value={task.startDate ?? ''} disabled={!puedeEditar} onChange={(e) => guardar({ startDate: e.target.value || null })} />
              </div>
              {task.type !== 'EPIC' && (
                <div className="field">
                  <label htmlFor="t-parent">Épica</label>
                  <Form.Select id="t-parent" size="sm" value={task.parentId ?? ''} disabled={!puedeEditar} onChange={(e) => guardar({ parentId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Ninguna</option>
                    {epicas.map((ep) => <option key={ep.id} value={ep.id}>{ep.key} · {ep.title}</option>)}
                    {task.parentId && !epicas.some((ep) => ep.id === task.parentId) && <option value={task.parentId}>{task.parentKey} · {task.parentTitle}</option>}
                  </Form.Select>
                </div>
              )}
              <div className="field">
                <label htmlFor="t-estimate">Puntos</label>
                <Form.Control id="t-estimate" size="sm" type="number" min={0} max={999} value={task.estimate ?? ''} placeholder="sin estimar" disabled={!puedeEditar} onChange={(e) => guardar({ estimate: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="t-rec">Repetir</label>
                <Form.Select id="t-rec" size="sm" value={task.recurrence} disabled={!puedeEditar} onChange={(e) => guardar({ recurrence: e.target.value as Recurrence })} title="Al terminarla se crea la siguiente con la fecha desplazada">
                  {RECURRENCES.map((r) => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
                </Form.Select>
              </div>
              <div className="field">
                <label htmlFor="t-tags">Etiquetas</label>
                <div>
                  <Form.Control id="t-tags" size="sm" list="t-tags-list" value={tags} placeholder="separadas por comas" disabled={!puedeEditar} onChange={(e) => setTags(e.target.value)} onBlur={() => guardar({ tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })} />
                  <datalist id="t-tags-list">{etiquetasUsadas.map((t) => <option key={t} value={t} />)}</datalist>
                  {task.tags.length > 0 && <div className="mt-1"><Etiquetas tags={task.tags} max={8} /></div>}
                </div>
              </div>
              <hr />
              <div className="stamp">Creada por <b>{task.reporter.name}</b> · {fmtFechaHora(task.createdAt)}</div>
              <div className="stamp">Actualizada {hace(task.updatedAt)}</div>
              {done && task.closedAt && <div className="stamp">Cerrada {fmtFechaHora(task.closedAt)}</div>}
              {puedeEditar && (
                <Button size="sm" variant="outline-secondary" className="w-100 mt-3" onClick={guardarPlantilla} title="Guarda campos y subtareas para reutilizarlos"><JournalText /> Guardar como plantilla</Button>
              )}
              {(puedeEditar || hasFeature('tareas.borrar')) && (
                <div className="d-flex gap-2 mt-2">
                  {puedeEditar && <Button size="sm" variant="outline-secondary" className="w-100" onClick={duplicarTarea} title="Crea una copia en el mismo proyecto"><Files /> Duplicar</Button>}
                  {hasFeature('tareas.borrar') && <Button size="sm" variant="outline-danger" className="w-100" onClick={borrarTarea}><Trash /> Borrar</Button>}
                </div>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <Card.Title className="mb-2">Actividad</Card.Title>
              <ul className="activity">
                {actividad.map((a) => (
                  <li key={a.id}>
                    <span className="when" title={fmtFechaHora(a.createdAt)}>{hace(a.createdAt)}</span>
                    <span><ActividadTexto a={a} /></span>
                  </li>
                ))}
              </ul>
            </Card.Body>
          </Card>
        </aside>
      </div>

      {nuevaSub && (
        <NuevaTareaModal
          project={project}
          parent={task}
          onClose={() => setNuevaSub(false)}
          onCreated={async (t) => {
            setNuevaSub(false);
            setSubtareas((s) => [...s, t]);
            setTask({ ...task, subtaskCount: task.subtaskCount + 1 });
          }}
        />
      )}
    </div>
  );
}
