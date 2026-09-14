import { useMemo, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import type { ProjectDto, ProjectStatusDto, StatusCategory, TaskDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { useProyectos } from '../proyectos/ProyectosContext';
import { TaskCard } from './tareas-ui';

/** Columna del tablero global: agrupa los estados de todos los proyectos que comparten clave. */
interface Columna {
  key: string;
  name: string;
  color: string;
  category: StatusCategory;
  order: number;
}

const CAT_ORDER: Record<StatusCategory, number> = { TODO: 0, DOING: 1, DONE: 2 };

/** Columnas = unión de estados (por clave) de los proyectos presentes, ordenadas por categoría y orden. */
export function columnasGlobales(proyectos: ProjectDto[], tasks: TaskDto[]): Columna[] {
  const ids = new Set(tasks.map((t) => t.projectId));
  const m = new Map<string, Columna>();
  for (const p of proyectos) {
    if (!ids.has(p.id) && ids.size > 0) continue;
    for (const s of p.statuses) if (!m.has(s.key)) m.set(s.key, { key: s.key, name: s.name, color: s.color, category: s.category, order: s.order });
  }
  // Estados de tareas cuyo proyecto no esté en el contexto (archivado): que no se pierdan.
  for (const t of tasks) if (!m.has(t.status.key)) m.set(t.status.key, { key: t.status.key, name: t.status.name, color: t.status.color, category: t.status.category, order: t.status.order + 100 });
  return [...m.values()].sort((a, b) => CAT_ORDER[a.category] - CAT_ORDER[b.category] || a.order - b.order || a.name.localeCompare(b.name));
}

/** Estado del proyecto de la tarea que corresponde a una columna: misma clave; si no, misma categoría. */
function estadoDestino(project: ProjectDto | undefined, col: Columna): ProjectStatusDto | null {
  if (!project) return null;
  return project.statuses.find((s) => s.key === col.key) ?? project.statuses.find((s) => s.category === col.category) ?? null;
}

interface Props {
  tasks: TaskDto[];
  /** Tras mover (para recargar desde el servidor). */
  onChanged: () => void;
  /** Cambio optimista local (el padre guarda el estado). */
  setTasks: (t: TaskDto[]) => void;
  /** Qué pinta cada tarjeta debajo del título (por defecto, la clave del proyecto). */
  extra?: (t: TaskDto) => React.ReactNode;
}

/** Kanban de tareas de VARIOS proyectos. Funciona porque todos comparten el mismo juego de estados (por clave). */
export function TableroGlobal({ tasks, onChanged, setTasks, extra }: Props) {
  const { proyectos } = useProyectos();
  const { hasFeature } = useAuth();
  const [error, setError] = useState('');
  const puede = hasFeature('tareas.editar');

  const columnas = useMemo(() => columnasGlobales(proyectos, tasks), [proyectos, tasks]);
  const proyectoDe = useMemo(() => new Map(proyectos.map((p) => [p.id, p])), [proyectos]);
  const porColumna = useMemo(() => {
    const m = new Map<string, TaskDto[]>();
    for (const c of columnas) m.set(c.key, []);
    for (const t of tasks) {
      const col = columnas.find((c) => c.key === t.status.key) ?? columnas.find((c) => c.category === t.status.category);
      if (col) m.get(col.key)!.push(t);
    }
    // Dentro de una columna: por proyecto (orden del menú) y luego por orden de tablero.
    const idx = new Map(proyectos.map((p, i) => [p.id, i]));
    for (const arr of m.values()) arr.sort((a, b) => (idx.get(a.projectId) ?? 99) - (idx.get(b.projectId) ?? 99) || a.order - b.order);
    return m;
  }, [columnas, tasks, proyectos]);

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const id = Number(draggableId);
    const moved = tasks.find((t) => t.id === id);
    const col = columnas.find((c) => c.key === destination.droppableId);
    if (!moved || !col) return;
    const project = proyectos.find((p) => p.id === moved.projectId);
    const status = estadoDestino(project, col);
    if (!status) {
      setError(`El proyecto ${moved.projectKey} no tiene un estado equivalente a "${col.name}".`);
      return;
    }
    // Posición dentro del proyecto: cuántas tareas del MISMO proyecto quedan por delante en la columna.
    const columna = (porColumna.get(col.key) ?? []).filter((t) => t.id !== id);
    columna.splice(destination.index, 0, moved);
    const index = columna.slice(0, destination.index).filter((t) => t.projectId === moved.projectId).length;

    const antes = tasks;
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status, order: index - 0.5 } : t)));
    setError('');
    try {
      await tareasGateway.moverTarea(id, { statusId: status.id, index });
      onChanged();
    } catch (e) {
      setTasks(antes);
      setError((e as Error).message);
    }
  }

  return (
    <>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board">
          {columnas.map((c) => {
            const col = porColumna.get(c.key) ?? [];
            return (
              <div key={c.key} className="board-col">
                <div className="board-col-head">
                  <span className="status-dot" style={{ background: c.color }} />
                  {c.name}
                  <span className="count">{col.length}</span>
                </div>
                <Droppable droppableId={c.key} isDropDisabled={!puede}>
                  {(prov, snap) => (
                    <div ref={prov.innerRef} {...prov.droppableProps} className={`board-col-body ${snap.isDraggingOver ? 'over' : ''}`}>
                      {col.map((t, i) => {
                        // Las tarjetas van ordenadas por proyecto: cabecera con su nombre al empezar cada grupo.
                        const nuevoGrupo = i === 0 || col[i - 1].projectId !== t.projectId;
                        const p = proyectoDe.get(t.projectId);
                        return (
                          <div key={t.id}>
                            {nuevoGrupo && !snap.isDraggingOver && (
                              <div className="board-group">
                                <span className="nav-proj-dot" style={{ background: p?.color ?? 'var(--muted)' }} />
                                {p?.name ?? t.projectKey}
                                <span className="count">{col.filter((x) => x.projectId === t.projectId).length}</span>
                              </div>
                            )}
                            <Draggable draggableId={String(t.id)} index={i} isDragDisabled={!puede}>
                              {(dp, ds) => (
                                <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps}>
                                  <TaskCard task={t} dragging={ds.isDragging} extra={extra ? extra(t) : ds.isDragging ? <ProyectoChip task={t} /> : null} />
                                </div>
                              )}
                            </Draggable>
                          </div>
                        );
                      })}
                      {prov.placeholder}
                      {col.length === 0 && !snap.isDraggingOver && <div className="text-secondary small text-center py-3">vacío</div>}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
          {columnas.length === 0 && <div className="text-secondary small p-3">No hay tareas.</div>}
        </div>
      </DragDropContext>
    </>
  );
}

export function ProyectoChip({ task }: { task: TaskDto }) {
  const { proyectos } = useProyectos();
  const p = proyectos.find((x) => x.id === task.projectId);
  return (
    <span className="proj-chip" title={p?.name ?? task.projectKey}>
      <span className="nav-proj-dot" style={{ background: p?.color ?? 'var(--muted)' }} />
      {p?.name ?? task.projectKey}
    </span>
  );
}
