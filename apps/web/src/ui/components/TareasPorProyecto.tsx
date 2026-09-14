import { useMemo } from 'react';
import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import type { TaskDto } from '@yorga/contracts';
import { TaskRow } from './tareas-ui';
import { useProyectos } from '../proyectos/ProyectosContext';

/** Lista de tareas agrupada por proyecto (una tarjeta por proyecto, en el orden del menú). */
export function TareasPorProyecto({ tasks, empty }: { tasks: TaskDto[]; empty: string }) {
  const { proyectos } = useProyectos();

  const grupos = useMemo(() => {
    const m = new Map<string, TaskDto[]>();
    for (const t of tasks) m.set(t.projectKey, [...(m.get(t.projectKey) ?? []), t]);
    const orden = new Map(proyectos.map((p, i) => [p.key, i]));
    return [...m.entries()].sort(([a], [b]) => (orden.get(a) ?? 999) - (orden.get(b) ?? 999) || a.localeCompare(b));
  }, [tasks, proyectos]);

  if (grupos.length === 0) return <Card><Card.Body className="text-secondary">{empty}</Card.Body></Card>;

  return (
    <>
      {grupos.map(([key, ts]) => {
        const p = proyectos.find((x) => x.key === key);
        return (
          <Card key={key} className="mb-3">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <Card.Title className="mb-0 d-flex align-items-center gap-2">
                  {p && <span className="nav-proj-dot" style={{ background: p.color }} />}
                  <Link to={`/p/${key}`} className="text-decoration-none">{p?.name ?? key}</Link>
                  <span className="text-secondary fw-normal small">{key} · {ts.length}</span>
                </Card.Title>
              </div>
              {ts.map((t) => <TaskRow key={t.id} task={t} />)}
            </Card.Body>
          </Card>
        );
      })}
    </>
  );
}
