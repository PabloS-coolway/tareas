import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Form, Table } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { TaskDto, UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { Skeleton } from '../components/Skeleton';
import { Avatar } from '../components/tareas-ui';
import { TareasPorProyecto } from '../components/TareasPorProyecto';
import { useProyectos } from '../proyectos/ProyectosContext';

const SIN_ASIGNAR = 'none';

/** Fila de la matriz: una persona (o "sin asignar") con sus tareas abiertas por proyecto. */
interface Fila {
  id: string;
  user: UserRefDto | null;
  porProyecto: Map<string, number>;
  total: number;
  vencidas: number;
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function construirFilas(usuarios: UserRefDto[], tareas: TaskDto[]): Fila[] {
  const hoy = hoyIso();
  const filas = new Map<string, Fila>();
  for (const u of usuarios) filas.set(String(u.id), { id: String(u.id), user: u, porProyecto: new Map(), total: 0, vencidas: 0 });
  for (const t of tareas) {
    const id = t.assignee ? String(t.assignee.id) : SIN_ASIGNAR;
    let f = filas.get(id);
    if (!f) {
      // Asignada a alguien que ya no está en el directorio (desactivado) o sin asignar.
      f = { id, user: t.assignee, porProyecto: new Map(), total: 0, vencidas: 0 };
      filas.set(id, f);
    }
    f.porProyecto.set(t.projectKey, (f.porProyecto.get(t.projectKey) ?? 0) + 1);
    f.total += 1;
    if (t.dueDate && t.dueDate < hoy) f.vencidas += 1;
  }
  return [...filas.values()].sort((a, b) => {
    if (a.id === SIN_ASIGNAR) return 1;
    if (b.id === SIN_ASIGNAR) return -1;
    return b.total - a.total || (a.user?.name ?? '').localeCompare(b.user?.name ?? '');
  });
}

/** Equipo: quién tiene qué. Matriz personas × proyectos y, al elegir a alguien, sus tareas por proyecto. */
export function EquipoPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { proyectos } = useProyectos();
  const [usuarios, setUsuarios] = useState<UserRefDto[] | null>(null);
  const [abiertas, setAbiertas] = useState<TaskDto[] | null>(null);
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [includeDone, setIncludeDone] = useState(false);
  const [error, setError] = useState('');

  const seleccion = userId === SIN_ASIGNAR ? SIN_ASIGNAR : userId && /^\d+$/.test(userId) ? userId : '';

  useEffect(() => {
    Promise.all([tareasGateway.directorio(), tareasGateway.tareas({ pageSize: 1000 })])
      .then(([u, p]) => {
        setUsuarios(u);
        setAbiertas(p.items);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!seleccion) {
      setTasks(null);
      return;
    }
    setTasks(null);
    const assigneeId = seleccion === SIN_ASIGNAR ? SIN_ASIGNAR : Number(seleccion);
    tareasGateway
      .tareas({ assigneeId, includeDone, doneDays: includeDone ? 30 : undefined, pageSize: 1000 })
      .then((p) => setTasks(p.items))
      .catch((e) => setError((e as Error).message));
  }, [seleccion, includeDone]);

  const filas = useMemo(() => (usuarios && abiertas ? construirFilas(usuarios, abiertas) : []), [usuarios, abiertas]);
  const filaSel = filas.find((f) => f.id === seleccion);
  const nombreSel = seleccion === SIN_ASIGNAR ? 'Sin asignar' : filaSel?.user?.name ?? usuarios?.find((u) => String(u.id) === seleccion)?.name ?? '';
  const proyectosConTareas = proyectos.filter((p) => filas.some((f) => f.porProyecto.has(p.key)));
  const totalAbiertas = filas.reduce((n, f) => n + f.total, 0);

  return (
    <div className="page page-wide">
      <header className="page-head mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-1">Equipo</h1>
          <p className="text-secondary mb-0">Quién tiene qué, por proyecto. Elige a una persona para ver sus tareas.</p>
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <Form.Select
            size="sm"
            style={{ width: 'auto', minWidth: 200 }}
            value={seleccion}
            aria-label="Persona"
            onChange={(e) => navigate(e.target.value ? `/equipo/${e.target.value}` : '/equipo')}
          >
            <option value="">Todo el equipo</option>
            {(usuarios ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            <option value={SIN_ASIGNAR}>Sin asignar</option>
          </Form.Select>
          {seleccion && (
            <Form.Check type="switch" id="eq-done" label="Incluir terminadas (30 días)" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} />
          )}
        </div>
      </header>
      {error && <Alert variant="danger">⚠ {error}</Alert>}

      {!seleccion ? (
        !usuarios || !abiertas ? (
          <Skeleton className="skeleton-rounded" width="100%" height={220} />
        ) : (
          <Card>
            <Card.Body className="p-0">
              <div style={{ overflowX: 'auto' }}>
                <Table hover responsive={false} className="mb-0 align-middle tabular equipo-matriz">
                  <thead>
                    <tr>
                      <th>Persona</th>
                      {proyectosConTareas.map((p) => (
                        <th key={p.id} className="text-center" title={p.name}>
                          <Link to={`/p/${p.key}`} className="text-decoration-none d-inline-flex align-items-center gap-1">
                            <span className="nav-proj-dot" style={{ background: p.color }} />{p.key}
                          </Link>
                        </th>
                      ))}
                      <th className="text-center">Abiertas</th>
                      <th className="text-center">Vencidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.id} role="link" tabIndex={0} className="equipo-fila" onClick={() => navigate(`/equipo/${f.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/equipo/${f.id}`)}>
                        <td>
                          <span className="d-inline-flex align-items-center gap-2">
                            <Avatar user={f.user} />
                            <span>{f.user ? f.user.name : <span className="text-secondary">Sin asignar</span>}</span>
                          </span>
                        </td>
                        {proyectosConTareas.map((p) => {
                          const n = f.porProyecto.get(p.key) ?? 0;
                          return <td key={p.id} className={`text-center ${n === 0 ? 'text-secondary opacity-50' : ''}`}>{n === 0 ? '·' : n}</td>;
                        })}
                        <td className="text-center fw-semibold">{f.total}</td>
                        <td className={`text-center ${f.vencidas > 0 ? 'text-danger fw-semibold' : 'text-secondary opacity-50'}`}>{f.vencidas > 0 ? f.vencidas : '·'}</td>
                      </tr>
                    ))}
                    {filas.length === 0 && (
                      <tr><td colSpan={proyectosConTareas.length + 3} className="text-secondary">No hay tareas abiertas.</td></tr>
                    )}
                  </tbody>
                  {filas.length > 1 && (
                    <tfoot>
                      <tr className="table-light">
                        <td className="fw-semibold">Total</td>
                        {proyectosConTareas.map((p) => (
                          <td key={p.id} className="text-center fw-semibold">{filas.reduce((n, f) => n + (f.porProyecto.get(p.key) ?? 0), 0)}</td>
                        ))}
                        <td className="text-center fw-semibold">{totalAbiertas}</td>
                        <td className="text-center fw-semibold">{filas.reduce((n, f) => n + f.vencidas, 0)}</td>
                      </tr>
                    </tfoot>
                  )}
                </Table>
              </div>
            </Card.Body>
          </Card>
        )
      ) : (
        <>
          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
            <Avatar user={filaSel?.user ?? null} size="lg" title={nombreSel} />
            <span className="fw-semibold fs-5">{nombreSel}</span>
            {filaSel && (
              <span className="text-secondary small">
                {filaSel.total} abiertas{filaSel.vencidas > 0 && <span className="text-danger"> · {filaSel.vencidas} vencidas</span>}
              </span>
            )}
            <Link to="/equipo" className="ms-auto small">← Todo el equipo</Link>
          </div>
          {!tasks ? (
            <Skeleton className="skeleton-rounded" width="100%" height={200} />
          ) : (
            <TareasPorProyecto tasks={tasks} empty={seleccion === SIN_ASIGNAR ? 'No hay tareas sin asignar.' : `${nombreSel} no tiene tareas asignadas.`} />
          )}
        </>
      )}
    </div>
  );
}
