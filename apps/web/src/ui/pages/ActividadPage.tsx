import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import type { ActivityFeedItemDto, UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { hace } from '../components/tareas-ui';
import { ActividadTexto } from '../components/ActividadTexto';
import { Skeleton } from '../components/Skeleton';
import { useProyectos } from '../proyectos/ProyectosContext';

/** Actividad completa del equipo, filtrable por proyecto y persona. */
export function ActividadPage() {
  const { proyectos } = useProyectos();
  const [items, setItems] = useState<ActivityFeedItemDto[] | null>(null);
  const [equipo, setEquipo] = useState<UserRefDto[]>([]);
  const [projectId, setProjectId] = useState('');
  const [actorId, setActorId] = useState('');
  const [error, setError] = useState('');
  const [hayMas, setHayMas] = useState(true);
  const [cargando, setCargando] = useState(false);
  const TRAMO = 30;

  useEffect(() => {
    tareasGateway.directorio().then(setEquipo).catch(() => setEquipo([]));
  }, []);

  const filtro = () => ({ projectId: projectId ? Number(projectId) : undefined, actorId: actorId ? Number(actorId) : undefined });

  useEffect(() => {
    setItems(null);
    setHayMas(true);
    tareasGateway
      .feed(TRAMO, filtro())
      .then((r) => {
        setItems(r);
        setHayMas(r.length === TRAMO);
      })
      .catch((e) => setError((e as Error).message));
  }, [projectId, actorId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargarMas() {
    if (!items?.length) return;
    setCargando(true);
    try {
      const r = await tareasGateway.feed(TRAMO, { ...filtro(), before: items[items.length - 1].id });
      setItems([...items, ...r]);
      setHayMas(r.length === TRAMO);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  // Agrupado por día para que se lea de un vistazo.
  const dias = new Map<string, ActivityFeedItemDto[]>();
  for (const a of items ?? []) {
    const d = a.createdAt.slice(0, 10);
    dias.set(d, [...(dias.get(d) ?? []), a]);
  }
  const hoy = new Date().toISOString().slice(0, 10);
  const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const titulo = (d: string) => (d === hoy ? 'Hoy' : d === ayer ? 'Ayer' : new Date(`${d}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));

  return (
    <div className="page page-wide">
      <header className="page-head mb-3 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-1">Actividad</h1>
          <p className="text-secondary mb-0">Lo que ha pasado en las tareas, por día, de 30 en 30.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Form.Select size="sm" style={{ width: 'auto' }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {proyectos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Form.Select>
          <Form.Select size="sm" style={{ width: 'auto' }} value={actorId} onChange={(e) => setActorId(e.target.value)}>
            <option value="">Cualquier persona</option>
            {equipo.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Form.Select>
        </div>
      </header>
      {error && <Alert variant="danger">⚠ {error}</Alert>}
      {!items ? (
        <Skeleton className="skeleton-rounded" width="100%" height={240} />
      ) : items.length === 0 ? (
        <Card><Card.Body className="text-secondary">Sin actividad con ese filtro.</Card.Body></Card>
      ) : (
        [...dias.entries()].map(([d, as]) => (
          <Card key={d} className="mb-3">
            <Card.Body>
              <Card.Title className="mb-2 text-capitalize">{titulo(d)} <span className="text-secondary fw-normal small">{as.length}</span></Card.Title>
              <ul className="activity feed">
                {as.map((a) => (
                  <li key={a.id}>
                    <span className="when">{hace(a.createdAt)}</span>
                    <span>
                      <ActividadTexto a={a} /> en <Link to={`/t/${a.taskKey}`} className="text-decoration-none"><span className="task-key">{a.taskKey}</span> {a.taskTitle}</Link>
                    </span>
                  </li>
                ))}
              </ul>
            </Card.Body>
          </Card>
        ))
      )}
      {items && items.length > 0 && hayMas && (
        <div className="text-center mb-3">
          <Button variant="outline-secondary" size="sm" disabled={cargando} onClick={cargarMas}>{cargando ? <Spinner size="sm" animation="border" /> : `Cargar ${TRAMO} más`}</Button>
        </div>
      )}
    </div>
  );
}
