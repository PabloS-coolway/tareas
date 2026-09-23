import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, ButtonGroup, Form } from 'react-bootstrap';
import { Calendar3, ChevronLeft, ChevronRight, BarChartSteps } from 'react-bootstrap-icons';
import type { TaskDto, UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { useProyectos } from '../proyectos/ProyectosContext';
import { useFiltrosUrl } from '../filtros/useFiltrosUrl';
import { Skeleton } from '../components/Skeleton';
import { barra, diasEntre, inicioDeMes, iso, lunesDe, mesDe, rejillaMes, sumarDias, sumarMeses } from '../calendario/fechas';

/** `mes` vacío = el mes actual (el valor por defecto tiene que ser fijo para no ensuciar la URL). */
const FILTROS = { vista: 'mes', mes: '', projectId: '', assignee: '', sigo: false, includeDone: false };
const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MAX_DIA = 4;
const SEMANAS_CRONO = 6;

/** Calendario (por vencimiento) y cronograma (inicio → vencimiento) de las tareas. */
export function CalendarioPage() {
  const { hasFeature } = useAuth();
  const puedeEditar = hasFeature('tareas.editar');
  const { proyectos } = useProyectos();
  const { filtros, cambiar } = useFiltrosUrl(FILTROS, 'calendario');
  const { vista, projectId, assignee, sigo, includeDone } = filtros;
  const hoy = iso(new Date());
  const mes = filtros.mes || mesDe(hoy);

  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [equipo, setEquipo] = useState<UserRefDto[]>([]);
  const [error, setError] = useState('');
  const [sobre, setSobre] = useState<string | null>(null);

  // Ventana visible: la rejilla del mes, o 6 semanas desde el lunes de la semana del día 1.
  const semanas = useMemo(() => rejillaMes(mes), [mes]);
  const desde = vista === 'mes' ? semanas[0][0] : lunesDe(inicioDeMes(mes));
  const hasta = vista === 'mes' ? semanas[semanas.length - 1][6] : sumarDias(desde, SEMANAS_CRONO * 7 - 1);

  const load = useCallback(async () => {
    setError('');
    try {
      const p = await tareasGateway.tareas({
        dueFrom: desde,
        dueTo: hasta,
        projectId: projectId ? Number(projectId) : undefined,
        ...(sigo ? { followedBy: 'me' as const } : {}),
        assigneeId: assignee === 'me' || assignee === 'none' ? assignee : assignee ? Number(assignee) : undefined,
        includeDone,
        pageSize: 1000,
      });
      setTasks(p.items.filter((t) => t.type !== 'EPIC'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [desde, hasta, projectId, assignee, sigo, includeDone]);

  useEffect(() => {
    setTasks(null);
    void load();
  }, [load]);
  useEffect(() => {
    tareasGateway.directorio().then(setEquipo).catch(() => setEquipo([]));
  }, []);

  const color = useMemo(() => new Map(proyectos.map((p) => [p.id, p.color])), [proyectos]);
  const porDia = useMemo(() => {
    const m = new Map<string, TaskDto[]>();
    for (const t of tasks ?? []) if (t.dueDate) m.set(t.dueDate, [...(m.get(t.dueDate) ?? []), t]);
    return m;
  }, [tasks]);

  // Arrastrar una tarea a otro día: cambia el vencimiento (y el inicio, si lo tiene, para conservar la duración).
  async function soltar(e: DragEvent, dia: string) {
    e.preventDefault();
    setSobre(null);
    const id = Number(e.dataTransfer.getData('text/plain'));
    const t = tasks?.find((x) => x.id === id);
    if (!t || !t.dueDate || t.dueDate === dia) return;
    const delta = diasEntre(t.dueDate, dia);
    const antes = tasks;
    setTasks((ts) => ts?.map((x) => (x.id === id ? { ...x, dueDate: dia, startDate: x.startDate ? sumarDias(x.startDate, delta) : null } : x)) ?? null);
    try {
      await tareasGateway.editarTarea(id, { dueDate: dia, ...(t.startDate ? { startDate: sumarDias(t.startDate, delta) } : {}) });
    } catch (err) {
      setTasks(antes);
      setError((err as Error).message);
    }
  }

  const chip = (t: TaskDto) => {
    const hecha = t.status.category === 'DONE';
    const vencida = !hecha && t.dueDate! < hoy;
    return (
      <Link
        key={t.id}
        to={`/t/${t.key}`}
        className={`cal-chip ${hecha ? 'hecha' : ''} ${vencida ? 'vencida' : ''}`}
        style={{ borderLeftColor: color.get(t.projectId) ?? 'var(--muted)' }}
        draggable={puedeEditar}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', String(t.id))}
        title={`${t.key} · ${t.title}${t.assignee ? ` → ${t.assignee.name}` : ''} · ${t.status.name}`}
      >
        <span className="task-key">{t.key}</span> {t.title}
      </Link>
    );
  };

  const mesLargo = new Date(`${inicioDeMes(mes)}T00:00:00Z`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const titulo = mesLargo.charAt(0).toUpperCase() + mesLargo.slice(1); // «Octubre de 2026»

  return (
    <div className="page page-wide">
      <header className="page-head mb-3 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-0">Calendario</h1>
          <div className="small text-secondary">Tareas por fecha de vencimiento{puedeEditar && vista === 'mes' ? ' · arrastra una tarea a otro día para cambiar su fecha' : ''}</div>
        </div>
        <ButtonGroup size="sm" className="view-toggle">
          <Button variant={vista === 'mes' ? 'primary' : 'outline-secondary'} onClick={() => cambiar({ vista: 'mes' })} title="Mes"><Calendar3 /> Mes</Button>
          <Button variant={vista === 'crono' ? 'primary' : 'outline-secondary'} onClick={() => cambiar({ vista: 'crono' })} title="Cronograma"><BarChartSteps /> Cronograma</Button>
        </ButtonGroup>
      </header>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}

      <div className="board-toolbar">
        <ButtonGroup size="sm">
          <Button variant="outline-secondary" onClick={() => cambiar({ mes: sumarMeses(mes, -1) })} aria-label="Mes anterior"><ChevronLeft /></Button>
          <Button variant="outline-secondary" onClick={() => cambiar({ mes: '' })}>Hoy</Button>
          <Button variant="outline-secondary" onClick={() => cambiar({ mes: sumarMeses(mes, 1) })} aria-label="Mes siguiente"><ChevronRight /></Button>
        </ButtonGroup>
        <span className="fw-semibold">{titulo}</span>
        <Form.Select id="cal-project" size="sm" value={projectId} onChange={(e) => cambiar({ projectId: e.target.value })}>
          <option value="">Todos los proyectos</option>
          {proyectos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Form.Select>
        <Form.Select id="cal-assignee" size="sm" value={assignee} onChange={(e) => cambiar({ assignee: e.target.value })}>
          <option value="">Cualquier asignado</option>
          <option value="me">Mías</option>
          <option value="none">Sin asignar</option>
          {equipo.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Form.Select>
        <button type="button" className={`toolbar-chip ${sigo ? 'on' : ''}`} onClick={() => cambiar({ sigo: !sigo })}>Sigo yo</button>
        <Form.Check type="switch" id="cal-done" label="Terminadas" checked={includeDone} onChange={(e) => cambiar({ includeDone: e.target.checked })} className="small" />
      </div>

      {!tasks ? (
        <Skeleton className="skeleton-rounded" width="100%" height={420} />
      ) : vista === 'mes' ? (
        <div className="cal">
          {DIAS.map((d) => <div key={d} className="calm-head">{d}</div>)}
          {semanas.flat().map((dia) => {
            const ts = porDia.get(dia) ?? [];
            return (
              <div
                key={dia}
                className={`cal-dia ${mesDe(dia) !== mes ? 'fuera' : ''} ${dia === hoy ? 'hoy' : ''} ${sobre === dia ? 'sobre' : ''}`}
                onDragOver={(e) => { if (puedeEditar) { e.preventDefault(); setSobre(dia); } }}
                onDragLeave={() => setSobre((s) => (s === dia ? null : s))}
                onDrop={(e) => void soltar(e, dia)}
              >
                <div className="calm-num">{Number(dia.slice(8))}</div>
                {ts.slice(0, MAX_DIA).map(chip)}
                {ts.length > MAX_DIA && (
                  <details className="cal-mas">
                    <summary>+{ts.length - MAX_DIA} más</summary>
                    {ts.slice(MAX_DIA).map(chip)}
                  </details>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Cronograma tasks={tasks} desde={desde} hoy={hoy} color={color} proyectos={proyectos.map((p) => ({ id: p.id, name: p.name }))} />
      )}
    </div>
  );
}

function Cronograma({ tasks, desde, hoy, color, proyectos }: { tasks: TaskDto[]; desde: string; hoy: string; color: Map<number, string>; proyectos: { id: number; name: string }[] }) {
  const dias = SEMANAS_CRONO * 7;
  const columnas = Array.from({ length: dias }, (_, i) => sumarDias(desde, i));
  const filas = [...tasks].sort((a, b) => a.projectId - b.projectId || (a.startDate ?? a.dueDate ?? '').localeCompare(b.startDate ?? b.dueDate ?? ''));
  const nombre = new Map(proyectos.map((p) => [p.id, p.name]));
  const hoyCol = diasEntre(desde, hoy);
  if (!filas.length) return <div className="text-secondary text-center py-5">No hay tareas con fecha en estas semanas.</div>;
  let ultimo = -1;
  return (
    <div className="crono" style={{ ['--dias' as string]: dias }}>
      <div className="crono-row crono-cabecera">
        <div className="crono-label" />
        <div className="crono-track">
          {columnas.map((d, i) => (
            <div key={d} className={`crono-col ${new Date(`${d}T00:00:00Z`).getUTCDay() === 1 ? 'lunes' : ''}`} style={{ gridColumn: i + 1 }}>
              {new Date(`${d}T00:00:00Z`).getUTCDay() === 1 ? `${Number(d.slice(8))}/${Number(d.slice(5, 7))}` : ''}
            </div>
          ))}
        </div>
      </div>
      {filas.map((t) => {
        const b = barra(t, desde, dias);
        const cabecera = t.projectId !== ultimo;
        ultimo = t.projectId;
        return (
          <div key={t.id}>
            {cabecera && <div className="crono-proyecto"><span className="nav-proj-dot" style={{ background: color.get(t.projectId) }} /> {nombre.get(t.projectId) ?? t.projectKey}</div>}
            <div className="crono-row">
              <Link to={`/t/${t.key}`} className="crono-label text-decoration-none" title={t.title}>
                <span className="task-key">{t.key}</span> {t.title}
              </Link>
              <div className="crono-track">
                {hoyCol >= 0 && hoyCol < dias && <div className="crono-hoy" style={{ gridColumn: hoyCol + 1 }} />}
                {b && (
                  <Link
                    to={`/t/${t.key}`}
                    className={`crono-barra ${t.status.category === 'DONE' ? 'hecha' : ''} ${b.cortadaIzq ? 'cort-izq' : ''} ${b.cortadaDer ? 'cort-der' : ''}`}
                    style={{ gridColumn: `${b.inicio + 1} / span ${b.largo}`, background: color.get(t.projectId) ?? 'var(--brand)' }}
                    title={`${t.key} · ${t.startDate ?? t.dueDate} → ${t.dueDate}${t.assignee ? ` · ${t.assignee.name}` : ''}`}
                  >
                    {t.assignee?.name ?? ''}
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
