import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import type { TaskDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { TaskRow } from '../components/tareas-ui';
import { Skeleton } from '../components/Skeleton';

export function MisTareasPage() {
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [error, setError] = useState('');
  const [includeDone, setIncludeDone] = useState(false);

  useEffect(() => {
    setTasks(null);
    tareasGateway
      .tareas({ assigneeId: 'me', includeDone, doneDays: includeDone ? 30 : undefined, pageSize: 1000 })
      .then((p) => setTasks(p.items))
      .catch((e) => setError((e as Error).message));
  }, [includeDone]);

  const grupos = useMemo(() => {
    const m = new Map<string, TaskDto[]>();
    for (const t of tasks ?? []) m.set(t.projectKey, [...(m.get(t.projectKey) ?? []), t]);
    return [...m.entries()];
  }, [tasks]);

  return (
    <div className="page page-wide">
      <header className="page-head mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-1">Mis tareas</h1>
          <p className="text-secondary mb-0">Todo lo que tienes asignado, por proyecto.</p>
        </div>
        <Form.Check type="switch" id="mt-done" label="Incluir terminadas (30 días)" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} />
      </header>
      {error && <Alert variant="danger">⚠ {error}</Alert>}
      {!tasks ? (
        <Skeleton className="skeleton-rounded" width="100%" height={200} />
      ) : grupos.length === 0 ? (
        <Card><Card.Body className="text-secondary">No tienes tareas asignadas.</Card.Body></Card>
      ) : (
        grupos.map(([key, ts]) => (
          <Card key={key} className="mb-3">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <Card.Title className="mb-0">
                  <Link to={`/p/${key}`} className="text-decoration-none">{key}</Link>
                  <span className="text-secondary fw-normal ms-2 small">{ts.length}</span>
                </Card.Title>
              </div>
              {ts.map((t) => <TaskRow key={t.id} task={t} />)}
            </Card.Body>
          </Card>
        ))
      )}
    </div>
  );
}
