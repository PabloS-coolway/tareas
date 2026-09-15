import { useEffect, useState } from 'react';
import { Alert, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import type { ActivityFeedItemDto, ResumenDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { TaskRow, hace } from '../components/tareas-ui';
import { ActividadTexto } from '../components/ActividadTexto';
import { Skeleton } from '../components/Skeleton';

export function InicioPage() {
  const { user } = useAuth();
  const [r, setR] = useState<ResumenDto | null>(null);
  const [feed, setFeed] = useState<ActivityFeedItemDto[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    tareasGateway.resumen().then(setR).catch((e) => setError((e as Error).message));
    tareasGateway.feed(8).then(setFeed).catch(() => setFeed([]));
  }, []);

  return (
    <div className="page page-wide">
      <header className="page-head mb-4">
        <h1 className="h4 mb-1">Hola, {user?.name.split(' ')[0]}</h1>
        <p className="text-secondary mb-0">Lo tuyo primero; después, cómo va cada proyecto.</p>
      </header>
      {error && <Alert variant="danger">⚠ {error}</Alert>}

      {!r ? (
        <Skeleton className="skeleton-rounded" width="100%" height={220} />
      ) : (
        <>
          <div className="kpis mb-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Link to="/mis-tareas" className="kpi text-decoration-none">
              <div className="kpi-val">{r.misAbiertas}</div>
              <div className="kpi-lbl">tareas abiertas asignadas a ti</div>
            </Link>
            <div className={`kpi ${r.misVencidas > 0 ? 'kpi-warn' : 'kpi-ok'}`}>
              <div className="kpi-val">{r.misVencidas}</div>
              <div className="kpi-lbl">vencidas</div>
            </div>
            <div className="kpi">
              <div className="kpi-val">{r.porProyecto.reduce((a, p) => a + p.open, 0)}</div>
              <div className="kpi-lbl">abiertas en todo el equipo</div>
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-7">
              <Card>
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <Card.Title className="mb-0">Lo que te vence antes</Card.Title>
                    <Link to="/mis-tareas" className="small">ver todas</Link>
                  </div>
                  {r.proximas.length === 0 ? (
                    <p className="text-secondary mb-0">No tienes tareas abiertas. 🎉</p>
                  ) : (
                    r.proximas.map((t) => <TaskRow key={t.id} task={t} showProject />)
                  )}
                </Card.Body>
              </Card>
            </div>
            <div className="col-lg-5">
              <Card>
                <Card.Body>
                  <Card.Title className="mb-2">Proyectos</Card.Title>
                  {r.porProyecto.map((p) => (
                    <Link key={p.projectId} to={`/p/${p.key}`} className="task-row" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto' }}>
                      <span className="proj-color" style={{ background: p.color }} />
                      <span className="title">
                        {p.name} <span className="proj-key ms-1">{p.key}</span>
                      </span>
                      <span className="small text-secondary">
                        {p.open} abiertas{p.mine > 0 && <> · <b className="text-brand">{p.mine} tuyas</b></>}
                      </span>
                    </Link>
                  ))}
                  {r.porProyecto.length === 0 && (
                    <p className="text-secondary mb-0">
                      Aún no hay proyectos. <Link to="/proyectos">Crea el primero</Link>.
                    </p>
                  )}
                </Card.Body>
              </Card>
            </div>
          </div>

          <Card className="mt-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Card.Title className="mb-0">Actividad reciente <span className="text-secondary fw-normal small">lo último en cualquier proyecto</span></Card.Title>
                <Link to="/actividad" className="small">ver toda</Link>
              </div>
              {feed.length === 0 ? (
                <p className="text-secondary mb-0">Todavía no hay actividad.</p>
              ) : (
                <ul className="activity feed compact">
                  {feed.map((a) => (
                    <li key={a.id}>
                      <span className="when">{hace(a.createdAt)}</span>
                      <span className="text-truncate">
                        <ActividadTexto a={a} /> en <Link to={`/t/${a.taskKey}`} className="text-decoration-none"><span className="task-key">{a.taskKey}</span> {a.taskTitle}</Link>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
}
