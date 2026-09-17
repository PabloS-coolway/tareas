import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Form, Modal, Spinner } from 'react-bootstrap';
import { ArrowDown, ArrowUp, CloudUpload, Gear, ListUl, Plus, Trash } from 'react-bootstrap-icons';
import { STATUS_CATEGORIES, STATUS_CATEGORY_LABELS, type ClickUpImportResultDto, type ProjectDto, type StatusCategory, type TeamDto, type UpsertStatusDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { useProyectos } from '../proyectos/ProyectosContext';

const COLORES = ['#6d28d9', '#0f766e', '#b45309', '#1d4ed8', '#be185d', '#047857', '#4338ca', '#0e7490', '#9f1239', '#374151'];

export function ProyectosPage() {
  const { hasFeature } = useAuth();
  const { proyectos, loading, reload } = useProyectos();
  const [nuevo, setNuevo] = useState(false);
  const [editar, setEditar] = useState<ProjectDto | null>(null);
  const [importar, setImportar] = useState(false);
  const [verArchivados, setVerArchivados] = useState(false);
  const [archivados, setArchivados] = useState<ProjectDto[]>([]);
  const gestiona = hasFeature('proyectos.gestionar');

  async function toggleArchivados(v: boolean) {
    setVerArchivados(v);
    if (v) setArchivados((await tareasGateway.proyectos(true)).filter((p) => p.archived));
  }

  const lista = verArchivados ? [...proyectos, ...archivados] : proyectos;

  return (
    <div className="page page-wide">
      <header className="page-head mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-1">Proyectos</h1>
          <p className="text-secondary mb-0">Un tablero por proyecto. Cada tarea lleva la clave del suyo (COOL-12).</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link to="/tareas" className="btn btn-outline-secondary"><ListUl className="me-1" /> Todas las tareas</Link>
          {gestiona && (
            <>
              <Button variant="outline-secondary" onClick={() => setImportar(true)}><CloudUpload className="me-1" /> Importar de ClickUp</Button>
              <Button className="btn-brand" onClick={() => setNuevo(true)}><Plus /> Nuevo proyecto</Button>
            </>
          )}
        </div>
      </header>

      <Form.Check type="switch" id="pr-arch" className="mb-3 small" label="Ver archivados" checked={verArchivados} onChange={(e) => toggleArchivados(e.target.checked)} />

      {loading ? (
        <Spinner animation="border" />
      ) : lista.length === 0 ? (
        <Card><Card.Body className="text-secondary">Aún no hay proyectos.{gestiona && ' Crea el primero o importa los de ClickUp.'}</Card.Body></Card>
      ) : (
        <div className="row g-3">
          {lista.map((p) => (
            <div key={p.id} className="col-md-6 col-xl-4">
              <div className="position-relative h-100">
                <Link to={`/p/${p.key}`} className="proj-card">
                  <Card>
                    <Card.Body>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="proj-color" style={{ background: p.color }} />
                        <span className="fw-bold">{p.name}</span>
                        <span className="proj-key ms-auto">{p.key}</span>
                      </div>
                      {p.description && <div className="small text-secondary mb-2">{p.description}</div>}
                      {p.teamName && <div className="small mb-1"><span className="pill ambito-pill equipo">equipo {p.teamName}</span></div>}
                      <div className="small text-secondary">
                        {p.openCount} abiertas{p.mineCount > 0 && <> · <b className="text-brand">{p.mineCount} tuyas</b></>}
                        {p.archived && <span className="badge bg-secondary-subtle text-secondary ms-2">archivado</span>}
                      </div>
                    </Card.Body>
                  </Card>
                </Link>
                {gestiona && (
                  <Button size="sm" variant="light" className="position-absolute" style={{ right: 10, bottom: 10 }} title="Configurar" onClick={() => setEditar(p)}><Gear /></Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {nuevo && <NuevoProyectoModal onClose={() => setNuevo(false)} onDone={async () => { setNuevo(false); await reload(); }} />}
      {editar && <EditarProyectoModal project={editar} onClose={() => setEditar(null)} onDone={async () => { setEditar(null); await reload(); if (verArchivados) await toggleArchivados(true); }} />}
      {importar && <ImportarClickUpModal onClose={() => setImportar(false)} onDone={reload} />}
    </div>
  );
}

function NuevoProyectoModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORES[0]);
  const [teamId, setTeamId] = useState('');
  const [equipos, setEquipos] = useState<TeamDto[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    tareasGateway.equipos().then((ts) => {
      setEquipos(ts);
      const mios = ts.filter((t) => t.mine);
      if (mios.length === 1) setTeamId(String(mios[0].id));
    }).catch(() => setEquipos([]));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await tareasGateway.crearProyecto({ key, name, description, color, teamId: teamId ? Number(teamId) : null });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal show onHide={onClose} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton><Modal.Title>Nuevo proyecto</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">⚠ {error}</Alert>}
          <div className="row g-3">
            <div className="col-8">
              <Form.Label className="small">Nombre</Form.Label>
              <Form.Control id="np-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-4">
              <Form.Label className="small">Clave</Form.Label>
              <Form.Control id="np-key" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="COOL" maxLength={24} required />
            </div>
          </div>
          <Form.Group className="mt-3">
            <Form.Label className="small">Descripción</Form.Label>
            <Form.Control id="np-desc" as="textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Form.Group>
          <Form.Group className="mt-3">
            <Form.Label className="small">Equipo</Form.Label>
            <Form.Select id="np-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Sin equipo · lo ve todo el mundo</option>
              {equipos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Form.Select>
            <Form.Text className="text-secondary">Sólo los miembros del equipo (y quien vea todo) verán este proyecto.</Form.Text>
          </Form.Group>
          <div className="mt-3">
            <Form.Label className="small d-block">Color</Form.Label>
            <div className="d-flex gap-2 flex-wrap">
              {COLORES.map((c) => (
                <button key={c} type="button" className="theme-dot" style={{ background: c, boxShadow: c === color ? '0 0 0 2px var(--ink)' : undefined }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="btn-brand" disabled={saving}>{saving ? <Spinner size="sm" animation="border" /> : 'Crear'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function EditarProyectoModal({ project, onClose, onDone }: { project: ProjectDto; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [color, setColor] = useState(project.color);
  const [archived, setArchived] = useState(project.archived);
  const [teamId, setTeamId] = useState(project.teamId ? String(project.teamId) : '');
  const [equipos, setEquipos] = useState<TeamDto[]>([]);
  useEffect(() => {
    tareasGateway.equipos().then(setEquipos).catch(() => setEquipos([]));
  }, []);
  const [statuses, setStatuses] = useState<UpsertStatusDto[]>(project.statuses.map((s) => ({ id: s.id, key: s.key, name: s.name, color: s.color, category: s.category, wipLimit: s.wipLimit })));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (i: number, patch: Partial<UpsertStatusDto>) => setStatuses((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const mover = (i: number, d: -1 | 1) =>
    setStatuses((ss) => {
      const j = i + d;
      if (j < 0 || j >= ss.length) return ss;
      const copia = [...ss];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await tareasGateway.editarProyecto(project.id, { name, description, color, archived, teamId: teamId ? Number(teamId) : null });
      await tareasGateway.guardarEstados(project.id, statuses.map((s) => ({ ...s, key: s.key || s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') })));
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal show onHide={onClose} size="lg" centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton><Modal.Title>{project.key} · configuración</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">⚠ {error}</Alert>}
          <div className="row g-3">
            <div className="col-md-8">
              <Form.Label className="small">Nombre</Form.Label>
              <Form.Control id="ep-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-md-4">
              <Form.Label className="small d-block">Color</Form.Label>
              <div className="d-flex gap-2 flex-wrap">
                {COLORES.map((c) => (
                  <button key={c} type="button" className="theme-dot" style={{ background: c, boxShadow: c === color ? '0 0 0 2px var(--ink)' : undefined }} onClick={() => setColor(c)} aria-label={c} />
                ))}
              </div>
            </div>
          </div>
          <Form.Group className="mt-3">
            <Form.Label className="small">Descripción</Form.Label>
            <Form.Control id="ep-desc" as="textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Form.Group>
          <Form.Group className="mt-3">
            <Form.Label className="small">Equipo</Form.Label>
            <Form.Select id="ep-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Sin equipo · lo ve todo el mundo</option>
              {equipos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Check className="mt-3" type="switch" id="ep-arch" label="Archivado (no aparece en el menú; las tareas se conservan)" checked={archived} onChange={(e) => setArchived(e.target.checked)} />

          <div className="form-step">Estados (columnas del tablero)</div>
          {statuses.map((s, i) => (
            <div key={s.id ?? `n${i}`} className="d-flex align-items-center gap-2 mb-2">
              <Form.Control type="color" size="sm" style={{ width: 44 }} value={s.color} onChange={(e) => set(i, { color: e.target.value })} title="Color" />
              <Form.Control size="sm" value={s.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Nombre" required />
              <Form.Select size="sm" style={{ width: 150 }} value={s.category} onChange={(e) => set(i, { category: e.target.value as StatusCategory })}>
                {STATUS_CATEGORIES.map((c) => <option key={c} value={c}>{STATUS_CATEGORY_LABELS[c]}</option>)}
              </Form.Select>
              <Form.Control size="sm" type="number" min={0} style={{ width: 70 }} value={s.wipLimit ?? ''} onChange={(e) => set(i, { wipLimit: e.target.value ? Number(e.target.value) : null })} placeholder="WIP" title="Límite de trabajo en curso (vacío = sin límite)" />
              <Button size="sm" variant="light" onClick={() => mover(i, -1)} disabled={i === 0} title="Subir"><ArrowUp /></Button>
              <Button size="sm" variant="light" onClick={() => mover(i, 1)} disabled={i === statuses.length - 1} title="Bajar"><ArrowDown /></Button>
              <Button size="sm" variant="light" className="text-danger" onClick={() => setStatuses((ss) => ss.filter((_, j) => j !== i))} disabled={statuses.length <= 1} title="Quitar"><Trash /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline-secondary" onClick={() => setStatuses((ss) => [...ss, { key: '', name: '', color: '#6b7280', category: 'DOING' }])}><Plus /> Añadir estado</Button>
          <div className="small text-secondary mt-2">Un estado con tareas no se puede quitar: muévelas antes. La categoría decide qué cuenta como terminado. WIP = máximo de tareas en la columna; si se supera, la cabecera avisa en rojo.</div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="btn-brand" disabled={saving}>{saving ? <Spinner size="sm" animation="border" /> : 'Guardar'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function ImportarClickUpModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [keys, setKeys] = useState('');
  const [adjuntos, setAdjuntos] = useState(true);
  const [estadosEstandar, setEstadosEstandar] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ClickUpImportResultDto | null>(null);

  async function run() {
    if (!file) return;
    setRunning(true);
    setError('');
    try {
      const data = JSON.parse(await file.text());
      const map: Record<string, string> = {};
      for (const line of keys.split('\n')) {
        const [id, k] = line.split('=').map((x) => x.trim());
        if (id && k) map[id] = k.toUpperCase();
      }
      setResult(await tareasGateway.importarClickUp(data, { keys: map, adjuntos, estadosEstandar }));
      await onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Modal show onHide={onClose} size="lg" centered>
      <Modal.Header closeButton><Modal.Title>Importar de ClickUp</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">⚠ {error}</Alert>}
        {!result ? (
          <>
            <p className="small text-secondary">
              Sube el fichero que genera <code>npm run clickup:export</code> (necesita un token de la API de ClickUp). Cada lista se convierte en un proyecto con sus tareas, subtareas, comentarios y adjuntos. Se puede repetir sin duplicar.
            </p>
            <Form.Group className="mb-3">
              <Form.Label className="small">Fichero JSON</Form.Label>
              <Form.Control id="ic-file" type="file" accept="application/json,.json" onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="small">Claves por lista (opcional; si no, se proponen) — una por línea: <code>idLista=CLAVE</code></Form.Label>
              <Form.Control id="ic-keys" as="textarea" rows={3} value={keys} onChange={(e) => setKeys(e.target.value)} placeholder={'901219597731=COOL\n901219752843=ULK'} />
            </Form.Group>
            <Form.Check type="switch" id="ic-std" className="mb-2" label="Mismo tablero en todos los proyectos (Pendiente · En curso · Bloqueada · Completado); los estados de ClickUp se traducen por su categoría" checked={estadosEstandar} onChange={(e) => setEstadosEstandar(e.target.checked)} />
            <Form.Check type="switch" id="ic-adj" label="Descargar adjuntos (más lento)" checked={adjuntos} onChange={(e) => setAdjuntos(e.target.checked)} />
          </>
        ) : (
          <>
            <Alert variant="success">
              Importados <b>{result.proyectos}</b> proyectos, <b>{result.tareas}</b> tareas, <b>{result.comentarios}</b> comentarios y <b>{result.adjuntos}</b> adjuntos.
            </Alert>
            {result.usuariosCreados.length > 0 && (
              <>
                <div className="fw-bold small mb-1">Usuarios creados (contraseña temporal; que la cambien al entrar):</div>
                <pre className="token-box">{result.usuariosCreados.map((u) => `${u.name} <${u.email}>  ${u.passwordTemporal}`).join('\n')}</pre>
              </>
            )}
            {result.avisos.length > 0 && (
              <>
                <div className="fw-bold small mt-3 mb-1">Avisos ({result.avisos.length})</div>
                <ul className="small">{result.avisos.slice(0, 50).map((a, i) => <li key={i}>{a}</li>)}</ul>
              </>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>{result ? 'Cerrar' : 'Cancelar'}</Button>
        {!result && <Button className="btn-brand" disabled={!file || running} onClick={run}>{running ? <><Spinner size="sm" animation="border" /> Importando…</> : 'Importar'}</Button>}
      </Modal.Footer>
    </Modal>
  );
}
