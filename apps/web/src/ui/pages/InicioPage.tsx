import { useEffect, useState } from 'react';
import { Alert, Card, ProgressBar } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import type { ActivityFeedItemDto, ResumenDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { TaskRow, hace } from '../components/tareas-ui';
import { Skeleton } from '../components/Skeleton';
import { ActividadTexto } from '../components/ActividadTexto';
import { PanelEquipo } from '../components/PanelEquipo';

function Delta({ a, b }: { a: number; b: number }) {
  const d = a - b;
  if (a === 0 && b === 0) return null;
  return <span className={`kpi-delta ${d === 0 ? '' : d > 0 ? 'up' : 'down'}`} title="frente a los 7 días anteriores">{d > 0 ? '+' : ''}{d}</span>;
}

/**
 * Inicio. Dirección (gestiona proyectos o usuarios): el equipo esta semana + lo suyo. Resto: sus KPIs y sus tareas.
 */
export function InicioPage() {
  const { user, hasFeature } = useAuth();
  const direccion = hasFeature('proyectos.gestionar') || hasFeature('usuarios.gestionar');
  const [r, setR] = useState<ResumenDto | null>(null);
  const [feed, setFeed] = useState<ActivityFeedItemDto[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    tareasGateway.resumen().then(setR).catch((e) => setError((e as Error).message));
    tareasGateway.feed(8).then(setFeed).catch(() => setFeed([]));
  }, []);

  const pct = r?.miSprint?.total ? Math.round((r.miSprint.done / r.miSprint.total) * 100) : 0;

  const misKpis = r && (
    <div className="kpis kpis-6 mb-4">
      <Link to="/mis-tareas" className="kpi text-decoration-none"><div className="kpi-val">{r.misAbiertas}</div><div className="kpi-lbl">abiertas</div></Link>
      <div className="kpi"><div className="kpi-val">{r.misEnCurso}</div><div className="kpi-lbl">en curso ahora</div></div>
      <div className={`kpi ${r.misVencidas > 0 ? 'kpi-warn' : 'kpi-ok'}`}><div className="kpi-val">{r.misVencidas}</div><div className="kpi-lbl">vencidas</div></div>
      <div className={`kpi ${r.misHechas7d >= r.misHechas7dPrev ? 'kpi-ok' : 'kpi-warn'}`}><div className="kpi-val">{r.misHechas7d} <Delta a={r.misHechas7d} b={r.misHechas7dPrev} /></div><div className="kpi-lbl">terminadas esta semana</div></div>
      <div className="kpi"><div className="kpi-val">{r.misNuevas7d}</div><div className="kpi-lbl">nuevas esta semana</div></div>
      <div className="kpi">
        {r.miSprint ? (
          <>
            <div className="kpi-val">{r.miSprint.done}/{r.miSprint.total}</div>
            <div className="kpi-lbl">en <Link to={`/sprints/${r.miSprint.id}`}>{r.miSprint.name}</Link>{r.miSprint.daysLeft !== null && <> · {r.miSprint.daysLeft} d</>}</div>
            <ProgressBar now={pct} className="sprint-progress mt-2" variant={pct === 100 ? 'success' : undefined} />
          </>
        ) : (
          <><div className="kpi-val">—</div><div className="kpi-lbl">sin sprint activo</div></>
        )}
      </div>
    </div>
  );

  const loTuyo = r && (
    <Card className="h-100">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Card.Title className="mb-0">Lo que te vence antes</Card.Title>
          <Link to="/mis-tareas" className="small">ver todas</Link>
        </div>
        {r.proximas.length === 0 ? <p className="text-secondary mb-0">No tienes tareas abiertas. 🎉</p> : r.proximas.slice(0, direccion ? 5 : 8).map((t) => <TaskRow key={t.id} task={t} showProject />)}
      </Card.Body>
    </Card>
  );

  const actividad = (
    <Card className="h-100">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Card.Title className="mb-0">Actividad reciente</Card.Title>
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
  );

  return (
    <div className="page page-wide">
      <header className="page-head mb-4">
        <h1 className="h4 mb-1">Hola, {user?.name.split(' ')[0]}</h1>
        <p className="text-secondary mb-0">{direccion ? 'Cómo va el equipo esta semana y lo tuyo.' : 'Tu semana de un vistazo.'}</p>
      </header>
      {error && <Alert variant="danger">⚠ {error}</Alert>}

      {!r ? (
        <Skeleton className="skeleton-rounded" width="100%" height={220} />
      ) : direccion ? (
        <>
          <PanelEquipo compacto />
          <div className="row g-4 mt-1">
            <div className="col-lg-6">{loTuyo}</div>
            <div className="col-lg-6">{actividad}</div>
          </div>
        </>
      ) : (
        <>
          {misKpis}
          <div className="row g-4">
            <div className="col-lg-7">{loTuyo}</div>
            <div className="col-lg-5">
              <Card className="h-100">
                <Card.Body>
                  <Card.Title className="mb-2">Mis proyectos</Card.Title>
                  {r.porProyecto.filter((p) => p.mine > 0).map((p) => (
                    <Link key={p.projectId} to={`/p/${p.key}`} className="task-row" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto' }}>
                      <span className="proj-color" style={{ background: p.color }} />
                      <span className="title">{p.name}</span>
                      <span className="small text-secondary"><b className="text-brand">{p.mine} tuyas</b> de {p.open}</span>
                    </Link>
                  ))}
                  {r.porProyecto.every((p) => p.mine === 0) && <p className="text-secondary mb-0">No tienes tareas asignadas en ningún proyecto.</p>}
                </Card.Body>
              </Card>
            </div>
            <div className="col-12">{actividad}</div>
          </div>
        </>
      )}
    </div>
  );
}
