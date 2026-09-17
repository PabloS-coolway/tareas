import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Form, Modal, ProgressBar, Spinner } from 'react-bootstrap';
import { Plus } from 'react-bootstrap-icons';
import { SPRINT_STATUS_LABELS, type CreateSprintDto, type SprintDto, type TeamDto, type UpdateSprintDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { Skeleton } from '../components/Skeleton';
import { fmtFecha } from '../components/tareas-ui';
import { useProyectos } from '../proyectos/ProyectosContext';

/** Ámbito del sprint: chip con el proyecto, el equipo o «global». */
export function SprintAmbito({ s }: { s: SprintDto }) {
  const { proyectos } = useProyectos();
  if (s.teamId) return <span className="pill ambito-pill equipo" title={`Tareas de los proyectos del equipo ${s.teamName ?? s.teamKey}`}>equipo {s.teamName ?? s.teamKey}</span>;
  if (!s.projectId) return <span className="pill ambito-pill transversal" title="Admite tareas de cualquier proyecto y equipo">global</span>;
  const color = proyectos.find((p) => p.id === s.projectId)?.color ?? 'var(--muted)';
  return (
    <span className="pill ambito-pill" title={`Sólo tareas de ${s.projectName ?? s.projectKey}`}>
      <span className="nav-proj-dot" style={{ background: color }} />
      {s.projectName ?? s.projectKey}
    </span>
  );
}

export function SprintBadge({ s }: { s: SprintDto }) {
  const bg = s.status === 'ACTIVE' ? 'primary' : s.status === 'CLOSED' ? 'secondary' : 'info';
  return <Badge bg={`${bg}-subtle`} text={bg}>{SPRINT_STATUS_LABELS[s.status]}</Badge>;
}

export function rangoSprint(s: SprintDto): string {
  if (!s.startDate && !s.endDate) return 'sin fechas';
  return `${s.startDate ? fmtFecha(s.startDate) : '…'} → ${s.endDate ? fmtFecha(s.endDate) : '…'}`;
}

/** Sprints de trabajo: lista y alta. */
export function SprintsPage() {
  const { hasFeature } = useAuth();
  const [sprints, setSprints] = useState<SprintDto[] | null>(null);
  const { proyectos } = useProyectos();
  const [params] = useSearchParams();
  const [verCerrados, setVerCerrados] = useState(params.get('cerrados') === '1');
  // Filtro de ámbito: todos, sólo transversales o los de un proyecto (por clave, para enlazar desde el tablero).
  const [ambito, setAmbito] = useState<string>(params.get('proyecto') ?? '');
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState('');
  const visibles = (sprints ?? []).filter((s) => (ambito === '' ? true : ambito === 'transversal' ? !s.projectId : ambito.startsWith('t:') ? s.teamKey === ambito.slice(2) : s.projectKey === ambito));
  const [equipos, setEquipos] = useState<TeamDto[]>([]);
  useEffect(() => {
    tareasGateway.equipos().then(setEquipos).catch(() => setEquipos([]));
  }, []);

  const load = useCallback(async () => {
    try {
      setSprints(await tareasGateway.sprints(verCerrados));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [verCerrados]);

  useEffect(() => {
    setSprints(null);
    void load();
  }, [load]);

  return (
    <div className="page page-wide">
      <header className="page-head mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-1">Sprints</h1>
          <p className="text-secondary mb-0">Bloques de trabajo con fecha. Un sprint <b>de equipo</b> junta tareas de los proyectos de ese equipo; uno <b>de proyecto</b>, sólo las suyas; uno <b>global</b>, de cualquiera. Para llenarlos desde el backlog, usa <Link to="/backlog">Planificación</Link>.</p>
        </div>
        {hasFeature('tareas.editar') && <Button className="btn-brand" onClick={() => setNuevo(true)}><Plus /> Nuevo sprint</Button>}
      </header>
      {error && <Alert variant="danger">⚠ {error}</Alert>}
      <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
        <Form.Select id="sp-ambito" size="sm" style={{ width: 'auto' }} value={ambito} onChange={(e) => setAmbito(e.target.value)}>
          <option value="">Todos los ámbitos</option>
          <option value="transversal">Globales y de equipo</option>
          {equipos.map((t) => <option key={t.id} value={`t:${t.key}`}>Equipo {t.name}</option>)}
          {proyectos.map((p) => <option key={p.id} value={p.key}>{p.name}</option>)}
        </Form.Select>
        <Form.Check type="switch" id="sp-closed" className="small" label="Ver cerrados" checked={verCerrados} onChange={(e) => setVerCerrados(e.target.checked)} />
      </div>

      {!sprints ? (
        <Skeleton className="skeleton-rounded" width="100%" height={160} />
      ) : visibles.length === 0 ? (
        <Card><Card.Body className="text-secondary">{sprints.length === 0 ? 'Aún no hay sprints. Crea el primero y añádele tareas desde el backlog.' : 'Ningún sprint con ese ámbito.'}</Card.Body></Card>
      ) : (
        <div className="sprint-grid">
          {visibles.map((s) => {
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <Card key={s.id} className={`sprint-card ${s.status === 'ACTIVE' ? 'active' : ''}`}>
                <Card.Body>
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                    <Link to={`/sprints/${s.id}`} className="fw-bold fs-5 text-decoration-none">{s.name}</Link>
                    <SprintBadge s={s} />
                  </div>
                  <div className="small text-secondary mb-2 d-flex align-items-center gap-2 flex-wrap"><SprintAmbito s={s} />{rangoSprint(s)}</div>
                  {s.goal && <div className="small mb-2 sprint-goal">{s.goal}</div>}
                  <ProgressBar now={pct} variant={pct === 100 ? 'success' : undefined} className="sprint-progress" />
                  <div className="small text-secondary mt-1">{s.done} de {s.total} terminadas{s.total > 0 && <> · {pct}%</>}</div>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}

      {nuevo && (
        <SprintModal
          projectId={ambito && ambito !== 'transversal' ? (proyectos.find((p) => p.key === ambito)?.id ?? null) : null}
          onClose={() => setNuevo(false)}
          onSaved={() => {
            setNuevo(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

/**
 * Alta o edición de un sprint (nombre, ámbito, objetivo, fechas). `projectId` preselecciona el ámbito al crear.
 * El ámbito se codifica como `p:<id>` (proyecto), `t:<id>` (equipo) o vacío (global).
 */
export function SprintModal({ sprint, projectId: proyectoInicial, onClose, onSaved }: { sprint?: SprintDto; projectId?: number | null; onClose: () => void; onSaved: (s: SprintDto) => void }) {
  const { proyectos } = useProyectos();
  const [equipos, setEquipos] = useState<TeamDto[]>([]);
  const [name, setName] = useState(sprint?.name ?? '');
  const [goal, setGoal] = useState(sprint?.goal ?? '');
  const [ambito, setAmbito] = useState<string>(sprint ? (sprint.projectId ? `p:${sprint.projectId}` : sprint.teamId ? `t:${sprint.teamId}` : '') : proyectoInicial ? `p:${proyectoInicial}` : '');
  useEffect(() => {
    tareasGateway.equipos().then((ts) => {
      setEquipos(ts);
      // Al crear sin proyecto: por defecto, el sprint de MI equipo (si sólo tengo uno); si no, global.
      if (!sprint && !proyectoInicial) {
        const mios = ts.filter((t) => t.mine);
        if (mios.length === 1) setAmbito(`t:${mios[0].id}`);
      }
    }).catch(() => setEquipos([]));
  }, [sprint, proyectoInicial]);
  const [startDate, setStartDate] = useState(sprint?.startDate ?? '');
  const [endDate, setEndDate] = useState(sprint?.endDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const dto: CreateSprintDto & UpdateSprintDto = {
        name,
        goal,
        projectId: ambito.startsWith('p:') ? Number(ambito.slice(2)) : null,
        teamId: ambito.startsWith('t:') ? Number(ambito.slice(2)) : null,
        startDate: startDate || null,
        endDate: endDate || null,
      };
      onSaved(sprint ? await tareasGateway.editarSprint(sprint.id, dto) : await tareasGateway.crearSprint(dto));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal show onHide={onClose} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton><Modal.Title>{sprint ? 'Editar sprint' : 'Nuevo sprint'}</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">⚠ {error}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label className="small">Nombre</Form.Label>
            <Form.Control id="sp-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 1 · 15–26 sep" required />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="small">Ámbito</Form.Label>
            <Form.Select id="sp-project" value={ambito} onChange={(e) => setAmbito(e.target.value)}>
              {equipos.map((t) => <option key={t.id} value={`t:${t.id}`}>Equipo {t.name} · tareas de sus proyectos{t.mine ? '' : ' (no eres miembro)'}</option>)}
              {proyectos.map((p) => <option key={p.id} value={`p:${p.id}`}>Sólo {p.name} ({p.key})</option>)}
              <option value="">Global · tareas de cualquier proyecto y equipo</option>
            </Form.Select>
            <Form.Text className="text-secondary">Un sprint de equipo admite tareas de los proyectos de ese equipo; uno de proyecto, sólo las suyas. Para cambiarlo después, todas sus tareas tienen que caber en el nuevo ámbito.</Form.Text>
          </Form.Group>
          <div className="row g-3">
            <div className="col-6">
              <Form.Label className="small">Empieza</Form.Label>
              <Form.Control id="sp-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="col-6">
              <Form.Label className="small">Termina</Form.Label>
              <Form.Control id="sp-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <Form.Group className="mt-3">
            <Form.Label className="small">Objetivo</Form.Label>
            <Form.Control id="sp-goal" as="textarea" rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Qué queremos tener hecho al terminar" />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="btn-brand" disabled={saving || !name.trim()}>{saving ? <Spinner size="sm" animation="border" /> : sprint ? 'Guardar' : 'Crear sprint'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
