import { useEffect, useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import type { TaskDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { Skeleton } from '../components/Skeleton';
import { TareasPorProyecto } from '../components/TareasPorProyecto';

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
      {!tasks ? <Skeleton className="skeleton-rounded" width="100%" height={200} /> : <TareasPorProyecto tasks={tasks} empty="No tienes tareas asignadas." />}
    </div>
  );
}
