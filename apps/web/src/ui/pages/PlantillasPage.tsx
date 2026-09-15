import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card } from 'react-bootstrap';
import { Trash } from 'react-bootstrap-icons';
import { PRIORITY_LABELS, TASK_TYPE_LABELS, type TaskTemplateDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { Skeleton } from '../components/Skeleton';
import { Etiquetas } from '../components/tareas-ui';
import { useProyectos } from '../proyectos/ProyectosContext';

/** Plantillas de tarea: se crean desde una tarea («Guardar como plantilla») y se usan al crear («Plantilla»). */
export function PlantillasPage() {
  const { hasFeature } = useAuth();
  const { proyectos } = useProyectos();
  const [items, setItems] = useState<TaskTemplateDto[] | null>(null);
  const [error, setError] = useState('');

  const load = () => tareasGateway.plantillas().then(setItems).catch((e) => setError((e as Error).message));
  useEffect(() => {
    void load();
  }, []);

  async function borrar(t: TaskTemplateDto) {
    if (!window.confirm(`¿Borrar la plantilla "${t.name}"?`)) return;
    try {
      await tareasGateway.borrarPlantilla(t.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page page-wide">
      <header className="page-head mb-4">
        <h1 className="h4 mb-1">Plantillas de tarea</h1>
        <p className="text-secondary mb-0">Abre cualquier tarea y pulsa «Guardar como plantilla». Después, al crear una tarea, elígela en «Plantilla» y se crean ella y sus subtareas.</p>
      </header>
      {error && <Alert variant="danger">⚠ {error}</Alert>}
      {!items ? (
        <Skeleton className="skeleton-rounded" width="100%" height={160} />
      ) : items.length === 0 ? (
        <Card><Card.Body className="text-secondary">Aún no hay plantillas.</Card.Body></Card>
      ) : (
        items.map((t) => {
          const p = proyectos.find((x) => x.id === t.projectId);
          return (
            <Card key={t.id} className="mb-3">
              <Card.Body>
                <div className="d-flex align-items-start justify-content-between gap-3">
                  <div style={{ minWidth: 0 }}>
                    <div className="fw-bold">{t.name} <Badge bg={p ? 'secondary-subtle' : 'info-subtle'} text={p ? 'secondary' : 'info'} className="ms-1">{p ? p.name : 'Todos los proyectos'}</Badge></div>
                    <div className="small text-secondary">Título: {t.title} · {TASK_TYPE_LABELS[t.type]} · {PRIORITY_LABELS[t.priority]}{t.estimate !== null && <> · {t.estimate} pt</>}</div>
                    {t.tags.length > 0 && <div className="mt-1"><Etiquetas tags={t.tags} max={8} /></div>}
                    {t.subtasks.length > 0 && (
                      <ul className="small mb-0 mt-2">
                        {t.subtasks.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    )}
                  </div>
                  {hasFeature('tareas.editar') && <Button size="sm" variant="outline-danger" onClick={() => borrar(t)} title="Borrar"><Trash /></Button>}
                </div>
              </Card.Body>
            </Card>
          );
        })
      )}
    </div>
  );
}
