import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Form, Modal, ProgressBar, Spinner } from 'react-bootstrap';
import { Plus } from 'react-bootstrap-icons';
import { SPRINT_STATUS_LABELS, type CreateSprintDto, type SprintDto, type UpdateSprintDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { Skeleton } from '../components/Skeleton';
import { fmtFecha } from '../components/tareas-ui';

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
  const [verCerrados, setVerCerrados] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState('');

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
          <p className="text-secondary mb-0">Bloques de trabajo con fecha. Un sprint junta tareas de cualquier proyecto en un solo tablero. Para llenarlos desde el backlog, usa <Link to="/backlog">Planificación</Link>.</p>
        </div>
        {hasFeature('tareas.editar') && <Button className="btn-brand" onClick={() => setNuevo(true)}><Plus /> Nuevo sprint</Button>}
      </header>
      {error && <Alert variant="danger">⚠ {error}</Alert>}
      <Form.Check type="switch" id="sp-closed" className="mb-3 small" label="Ver cerrados" checked={verCerrados} onChange={(e) => setVerCerrados(e.target.checked)} />

      {!sprints ? (
        <Skeleton className="skeleton-rounded" width="100%" height={160} />
      ) : sprints.length === 0 ? (
        <Card><Card.Body className="text-secondary">Aún no hay sprints. Crea el primero y añádele tareas desde el backlog.</Card.Body></Card>
      ) : (
        <div className="sprint-grid">
          {sprints.map((s) => {
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <Card key={s.id} className={`sprint-card ${s.status === 'ACTIVE' ? 'active' : ''}`}>
                <Card.Body>
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                    <Link to={`/sprints/${s.id}`} className="fw-bold fs-5 text-decoration-none">{s.name}</Link>
                    <SprintBadge s={s} />
                  </div>
                  <div className="small text-secondary mb-2">{rangoSprint(s)}</div>
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

/** Alta o edición de un sprint (nombre, objetivo, fechas). */
export function SprintModal({ sprint, onClose, onSaved }: { sprint?: SprintDto; onClose: () => void; onSaved: (s: SprintDto) => void }) {
  const [name, setName] = useState(sprint?.name ?? '');
  const [goal, setGoal] = useState(sprint?.goal ?? '');
  const [startDate, setStartDate] = useState(sprint?.startDate ?? '');
  const [endDate, setEndDate] = useState(sprint?.endDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const dto: CreateSprintDto & UpdateSprintDto = { name, goal, startDate: startDate || null, endDate: endDate || null };
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
