import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, ProgressBar } from 'react-bootstrap';
import type { KpisDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { Avatar } from './tareas-ui';
import { Skeleton } from './Skeleton';

/** Variación entre dos periodos, con signo. */
function Delta({ a, b, invertir }: { a: number; b: number; invertir?: boolean }) {
  if (b === 0 && a === 0) return null;
  const d = a - b;
  const bueno = invertir ? d < 0 : d > 0;
  return <span className={`kpi-delta ${d === 0 ? '' : bueno ? 'up' : 'down'}`} title="frente a los 7 días anteriores">{d > 0 ? '+' : ''}{d}</span>;
}

/** Barras semanales: creadas vs terminadas (dos series, leyenda y etiqueta directa de la última). */
function Semanas({ semanas }: { semanas: KpisDto['semanas'] }) {
  const W = 560;
  const H = 150;
  const M = { top: 10, right: 10, bottom: 24, left: 26 };
  const max = Math.max(1, ...semanas.map((s) => Math.max(s.created, s.done)));
  const gw = (W - M.left - M.right) / semanas.length;
  const bw = Math.min(18, gw * 0.32);
  const y = (v: number) => M.top + (1 - v / max) * (H - M.top - M.bottom);
  const [hover, setHover] = useState<number | null>(null);
  const etiqueta = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  };
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="burndown" role="img" aria-label="Tareas creadas y terminadas por semana" onMouseLeave={() => setHover(null)}>
        {[0, Math.round(max / 2), max].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={M.left - 5} y={y(t) + 3.5} fontSize={10} textAnchor="end" fill="var(--muted)">{t}</text>
          </g>
        ))}
        {semanas.map((s, i) => {
          const cx = M.left + gw * i + gw / 2;
          return (
            <g key={s.week} onMouseEnter={() => setHover(i)}>
              <rect x={M.left + gw * i} y={M.top} width={gw} height={H - M.top - M.bottom} fill="transparent" />
              <rect x={cx - bw - 1} y={y(s.created)} width={bw} height={Math.max(0, y(0) - y(s.created))} rx={3} fill="var(--muted)" opacity={0.55} />
              <rect x={cx + 1} y={y(s.done)} width={bw} height={Math.max(0, y(0) - y(s.done))} rx={3} fill="var(--brand)" />
              <text x={cx} y={H - 8} fontSize={10} textAnchor="middle" fill="var(--muted)">{etiqueta(s.week)}</text>
              {(hover === i || i === semanas.length - 1) && s.done > 0 && <text x={cx + 1 + bw / 2} y={y(s.done) - 4} fontSize={10} fontWeight={700} textAnchor="middle" fill="var(--ink)">{s.done}</text>}
              {hover === i && s.created > 0 && <text x={cx - 1 - bw / 2} y={y(s.created) - 4} fontSize={10} textAnchor="middle" fill="var(--muted)">{s.created}</text>}
            </g>
          );
        })}
      </svg>
      <div className="d-flex gap-3 small text-secondary mt-1">
        <span><span className="legend-sw" style={{ background: 'var(--muted)', opacity: 0.55 }} />Creadas</span>
        <span><span className="legend-sw" style={{ background: 'var(--brand)' }} />Terminadas</span>
        <span className="ms-auto">semana que empieza el lunes</span>
      </div>
    </div>
  );
}

/** Panel del equipo para dirección: caudal, salud, carga por persona y por proyecto. */
export function PanelEquipo() {
  const [k, setK] = useState<KpisDto | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    tareasGateway.kpis().then(setK).catch((e) => setError((e as Error).message));
  }, []);
  if (error) return <Alert variant="danger">⚠ {error}</Alert>;
  if (!k) return <Skeleton className="skeleton-rounded" width="100%" height={260} />;

  const neto7 = k.created7d - k.done7d;
  const pctSprint = k.activeSprint?.total ? Math.round((k.activeSprint.done / k.activeSprint.total) * 100) : 0;
  const tile = (val: React.ReactNode, lbl: string, cls = '', to?: string) => {
    const inner = (
      <>
        <div className="kpi-val">{val}</div>
        <div className="kpi-lbl">{lbl}</div>
      </>
    );
    return to ? <Link to={to} className={`kpi ${cls} text-decoration-none`}>{inner}</Link> : <div className={`kpi ${cls}`}>{inner}</div>;
  };

  return (
    <section className="mt-4">
      <div className="d-flex align-items-baseline justify-content-between mb-2">
        <h2 className="h5 mb-0">Panel del equipo</h2>
        <span className="small text-secondary">todo el equipo · últimos 7 días salvo que se indique</span>
      </div>

      <div className="kpis kpis-6 mb-3">
        {tile(<>{k.done7d} <Delta a={k.done7d} b={k.done7dPrev} /></>, 'terminadas esta semana', k.done7d >= k.done7dPrev ? 'kpi-ok' : 'kpi-warn')}
        {tile(k.created7d, 'creadas esta semana')}
        {tile(<>{neto7 > 0 ? '+' : ''}{neto7}</>, neto7 > 0 ? 'crece el backlog' : 'baja el backlog', neto7 > 0 ? 'kpi-warn' : 'kpi-ok')}
        {tile(k.leadTimeDays === null ? '—' : `${k.leadTimeDays} d`, 'lead time mediano (30 d)')}
        {tile(k.done30d, 'terminadas en 30 días')}
        {tile(k.avgAgeDays === null ? '—' : `${k.avgAgeDays} d`, 'antigüedad media de lo abierto')}
      </div>
      <div className="kpis kpis-6 mb-4">
        {tile(k.open, 'abiertas', '', '/tareas')}
        {tile(k.doing, 'en curso ahora', '', '/tareas')}
        {tile(k.overdue, 'vencidas', k.overdue > 0 ? 'kpi-warn' : 'kpi-ok', '/tareas')}
        {tile(k.unassigned, 'sin asignar', k.unassigned > 10 ? 'kpi-warn' : '', '/equipo/none')}
        {tile(k.blocked, 'bloqueadas', k.blocked > 0 ? 'kpi-warn' : 'kpi-ok')}
        {tile(k.stale, 'sin tocar > 30 días', k.stale > 20 ? 'kpi-warn' : '')}
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="mb-2">Caudal por semana <span className="text-secondary fw-normal small">creadas frente a terminadas, 8 semanas</span></Card.Title>
              <Semanas semanas={k.semanas} />
            </Card.Body>
          </Card>
        </div>
        <div className="col-lg-5">
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="mb-2">Sprint en curso</Card.Title>
              {k.activeSprint ? (
                <>
                  <Link to={`/sprints/${k.activeSprint.id}`} className="fw-bold text-decoration-none">{k.activeSprint.name}</Link>
                  <ProgressBar now={pctSprint} variant={pctSprint === 100 ? 'success' : undefined} className="sprint-progress my-2" />
                  <div className="small text-secondary">
                    {k.activeSprint.done} de {k.activeSprint.total} tareas ({pctSprint}%)
                    {k.activeSprint.points > 0 && <> · {k.activeSprint.pointsDone} de {k.activeSprint.points} puntos</>}
                    {k.activeSprint.daysLeft !== null && <> · {k.activeSprint.daysLeft === 0 ? 'termina hoy' : `quedan ${k.activeSprint.daysLeft} días`}</>}
                  </div>
                </>
              ) : (
                <p className="text-secondary mb-0">No hay ningún sprint activo. <Link to="/sprints">Planifica uno</Link>.</p>
              )}
              {k.urgentOpen > 0 && <div className="small mt-3"><span className="pill blocked">⚑ {k.urgentOpen} urgentes abiertas</span></div>}
            </Card.Body>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="mb-2">Carga por persona</Card.Title>
              <div className="kpi-table-wrap"><table className="table table-sm mb-0 tabular kpi-table">
                <thead><tr><th>Persona</th><th className="text-end">Abiertas</th><th className="text-end">En curso</th><th className="text-end">Vencidas</th><th className="text-end">Hechas 7d</th></tr></thead>
                <tbody>
                  {k.porPersona.map((p) => (
                    <tr key={p.user.id}>
                      <td><Link to={`/equipo/${p.user.id}`} className="text-decoration-none d-inline-flex align-items-center gap-2"><Avatar user={p.user} />{p.user.name}</Link></td>
                      <td className="text-end">{p.open}</td>
                      <td className="text-end">{p.doing}</td>
                      <td className={`text-end ${p.overdue ? 'text-danger fw-semibold' : 'text-secondary'}`}>{p.overdue || '·'}</td>
                      <td className="text-end">{p.done7d || '·'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="mb-2">Salud por proyecto</Card.Title>
              <div className="kpi-table-wrap"><table className="table table-sm mb-0 tabular kpi-table">
                <thead><tr><th>Proyecto</th><th className="text-end">Abiertas</th><th className="text-end">En curso</th><th className="text-end">Vencidas</th><th className="text-end">Nuevas 7d</th><th className="text-end">Hechas 7d</th></tr></thead>
                <tbody>
                  {k.porProyecto.map((p) => (
                    <tr key={p.projectId}>
                      <td><Link to={`/p/${p.key}`} className="text-decoration-none d-inline-flex align-items-center gap-2"><span className="nav-proj-dot" style={{ background: p.color }} />{p.name}</Link></td>
                      <td className="text-end">{p.open}</td>
                      <td className="text-end">{p.doing || '·'}</td>
                      <td className={`text-end ${p.overdue ? 'text-danger fw-semibold' : 'text-secondary'}`}>{p.overdue || '·'}</td>
                      <td className="text-end text-secondary">{p.created7d || '·'}</td>
                      <td className="text-end">{p.done7d || '·'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </section>
  );
}
