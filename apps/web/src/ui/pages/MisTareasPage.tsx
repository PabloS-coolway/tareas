import { useEffect, useState } from 'react';
import { Alert, Button, ButtonGroup, Form } from 'react-bootstrap';
import type { TaskDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { Skeleton } from '../components/Skeleton';
import { TareasPorProyecto } from '../components/TareasPorProyecto';
import { useFiltrosUrl } from '../filtros/useFiltrosUrl';

const FILTROS = { sigo: false, includeDone: false };

export function MisTareasPage() {
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [error, setError] = useState('');
  const { filtros, cambiar } = useFiltrosUrl(FILTROS, 'mis-tareas');
  const { sigo, includeDone } = filtros;

  useEffect(() => {
    setTasks(null);
    tareasGateway
      .tareas({ ...(sigo ? { followedBy: 'me' as const } : { assigneeId: 'me' as const }), includeDone, doneDays: includeDone ? 30 : undefined, pageSize: 1000 })
      .then((p) => setTasks(p.items))
      .catch((e) => setError((e as Error).message));
  }, [sigo, includeDone]);

  return (
    <div className="page page-wide">
      <header className="page-head mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-1">Mis tareas</h1>
          <p className="text-secondary mb-0">{sigo ? 'Las que sigues aunque no seas el responsable, por proyecto.' : 'Todo lo que tienes asignado, por proyecto.'}</p>
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <ButtonGroup size="sm">
            <Button variant={sigo ? 'outline-secondary' : 'primary'} onClick={() => cambiar({ sigo: false })}>Asignadas</Button>
            <Button variant={sigo ? 'primary' : 'outline-secondary'} onClick={() => cambiar({ sigo: true })}>Las que sigo</Button>
          </ButtonGroup>
          <Form.Check type="switch" id="mt-done" label="Incluir terminadas (30 días)" checked={includeDone} onChange={(e) => cambiar({ includeDone: e.target.checked })} />
        </div>
      </header>
      {error && <Alert variant="danger">⚠ {error}</Alert>}
      {!tasks ? <Skeleton className="skeleton-rounded" width="100%" height={200} /> : <TareasPorProyecto tasks={tasks} empty={sigo ? 'No sigues ninguna tarea.' : 'No tienes tareas asignadas.'} />}
    </div>
  );
}
