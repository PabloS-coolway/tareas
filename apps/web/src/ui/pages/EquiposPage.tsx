import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Form, Modal, Spinner } from 'react-bootstrap';
import { Pencil, Plus, Trash } from 'react-bootstrap-icons';
import type { TeamDto, UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { Avatar } from '../components/tareas-ui';
import { Skeleton } from '../components/Skeleton';
import { useProyectos } from '../proyectos/ProyectosContext';

const COLORES = ['#4338ca', '#0f766e', '#b45309', '#1d4ed8', '#be185d', '#047857', '#7c3aed', '#0e7490', '#9f1239', '#374151'];

/** Equipos (áreas): quién pertenece a cada uno y qué proyectos tiene. Decide quién ve qué. */
export function EquiposPage() {
  const { proyectos, reload } = useProyectos();
  const [equipos, setEquipos] = useState<TeamDto[] | null>(null);
  const [personas, setPersonas] = useState<UserRefDto[]>([]);
  const [error, setError] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [editar, setEditar] = useState<TeamDto | null>(null);

  const load = useCallback(async () => {
    try {
      const [ts, us] = await Promise.all([tareasGateway.equipos(), tareasGateway.directorio()]);
      setEquipos(ts);
      setPersonas(us);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function borrar(t: TeamDto) {
    if (!window.confirm(`¿Borrar el equipo "${t.name}"? Sus miembros dejan de verlo; sus sprints pasan a globales.`)) return;
    try {
      await tareasGateway.borrarEquipo(t.id);
      await load();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const nombre = (id: number) => personas.find((p) => p.id === id);

  return (
    <div className="page page-wide">
      <header className="page-head mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-1">Equipos</h1>
          <p className="text-secondary mb-0">Cada proyecto pertenece a un equipo y cada persona a uno o varios. Se ven los proyectos de tus equipos (y los que no tienen equipo); quien tenga «ver todo» lo ve todo. El equipo de cada proyecto se cambia en <Link to="/proyectos">Proyectos → configuración</Link>.</p>
        </div>
        <Button className="btn-brand" onClick={() => setNuevo(true)}><Plus /> Nuevo equipo</Button>
      </header>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}

      {!equipos ? (
        <Skeleton className="skeleton-rounded" width="100%" height={200} />
      ) : equipos.length === 0 ? (
        <Card><Card.Body className="text-secondary">Aún no hay equipos: todos ven todos los proyectos.</Card.Body></Card>
      ) : (
        <div className="row g-3">
          {equipos.map((t) => {
            const suyos = proyectos.filter((p) => p.teamId === t.id);
            return (
              <div key={t.id} className="col-lg-6">
                <Card className="h-100">
                  <Card.Body>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="proj-color" style={{ background: t.color, width: 14, height: 14 }} />
                      <span className="fw-bold fs-5">{t.name}</span>
                      <span className="proj-key">{t.key}</span>
                      {t.mine && <Badge bg="primary-subtle" text="primary">tuyo</Badge>}
                      <span className="ms-auto d-flex gap-1">
                        <Button size="sm" variant="light" title="Editar" onClick={() => setEditar(t)}><Pencil /></Button>
                        <Button size="sm" variant="light" className="text-danger" title="Borrar" onClick={() => borrar(t)} disabled={t.projectCount > 0}><Trash /></Button>
                      </span>
                    </div>
                    <div className="small text-secondary mb-1">Personas ({t.memberIds.length})</div>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {t.memberIds.length === 0 && <span className="small text-secondary">Nadie todavía.</span>}
                      {t.memberIds.map((id) => {
                        const u = nombre(id);
                        return u ? <span key={id} className="d-inline-flex align-items-center gap-1 small"><Avatar user={u} />{u.name}</span> : null;
                      })}
                    </div>
                    <div className="small text-secondary mb-1">Proyectos ({t.projectCount})</div>
                    <div className="d-flex flex-wrap gap-2">
                      {suyos.length === 0 && <span className="small text-secondary">{t.projectCount > 0 ? 'Proyectos que no ves.' : 'Ninguno: asígnalos desde Proyectos → configuración.'}</span>}
                      {suyos.map((p) => (
                        <Link key={p.id} to={`/p/${p.key}`} className="pill ambito-pill text-decoration-none"><span className="nav-proj-dot" style={{ background: p.color }} />{p.name}</Link>
                      ))}
                    </div>
                  </Card.Body>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {(nuevo || editar) && (
        <EquipoModal
          equipo={editar ?? undefined}
          personas={personas}
          onClose={() => {
            setNuevo(false);
            setEditar(null);
          }}
          onSaved={async () => {
            setNuevo(false);
            setEditar(null);
            await load();
            await reload();
          }}
        />
      )}
    </div>
  );
}

function EquipoModal({ equipo, personas, onClose, onSaved }: { equipo?: TeamDto; personas: UserRefDto[]; onClose: () => void; onSaved: () => void }) {
  const [key, setKey] = useState(equipo?.key ?? '');
  const [name, setName] = useState(equipo?.name ?? '');
  const [color, setColor] = useState(equipo?.color ?? COLORES[0]);
  const [miembros, setMiembros] = useState<Set<number>>(new Set(equipo?.memberIds ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id: number) => setMiembros((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (equipo) await tareasGateway.editarEquipo(equipo.id, { name, color, memberIds: [...miembros] });
      else await tareasGateway.crearEquipo({ key, name, color, memberIds: [...miembros] });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal show onHide={onClose} size="lg" centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton><Modal.Title>{equipo ? `Equipo ${equipo.name}` : 'Nuevo equipo'}</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">⚠ {error}</Alert>}
          <div className="row g-3">
            <div className="col-md-7">
              <Form.Label className="small">Nombre</Form.Label>
              <Form.Control id="eq-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Marketing" required />
            </div>
            <div className="col-md-5">
              <Form.Label className="small">Clave</Form.Label>
              <Form.Control id="eq-key" value={key} disabled={!!equipo} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="MKT" maxLength={12} required />
            </div>
          </div>
          <div className="mt-3">
            <Form.Label className="small d-block">Color</Form.Label>
            <div className="d-flex gap-2 flex-wrap">
              {COLORES.map((c) => (
                <button key={c} type="button" className="theme-dot" style={{ background: c, boxShadow: c === color ? '0 0 0 2px var(--ink)' : undefined }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="form-step">Personas del equipo</div>
          <div className="equipo-miembros">
            {personas.map((u) => (
              <Form.Check key={u.id} type="checkbox" id={`eq-m-${u.id}`} label={<span className="d-inline-flex align-items-center gap-2"><Avatar user={u} />{u.name}</span>} checked={miembros.has(u.id)} onChange={() => toggle(u.id)} />
            ))}
          </div>
          <div className="small text-secondary mt-2">Una persona puede estar en varios equipos. Los proyectos se asignan al equipo desde su configuración.</div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="btn-brand" disabled={saving || !name.trim() || (!equipo && !key.trim())}>{saving ? <Spinner size="sm" animation="border" /> : equipo ? 'Guardar' : 'Crear equipo'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
