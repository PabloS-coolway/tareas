import { useMemo, useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { PRIORITIES, PRIORITY_LABELS, type BulkUpdateTasksDto, type Priority, type ProjectDto, type SprintDto, type TaskDto, type UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';

interface Props {
  tareas: TaskDto[];
  proyectos: ProjectDto[];
  equipo: UserRefDto[];
  sprints: SprintDto[];
  limpiar: () => void;
  /** Tras guardar: recargar la lista; `aviso` = resumen para enseñar (errores incluidos). */
  hecho: (aviso: string) => void;
}

/** Barra de acciones sobre las tareas seleccionadas: estado, responsable, sprint, prioridad, etiquetas, seguimiento. */
export function AccionesEnBloque({ tareas, proyectos, equipo, sprints, limpiar, hecho }: Props) {
  const [guardando, setGuardando] = useState(false);
  const [etiqueta, setEtiqueta] = useState('');

  // Estados que existen en TODOS los proyectos de la selección (cada proyecto tiene los suyos; se casan por clave).
  const estados = useMemo(() => {
    const ids = new Set(tareas.map((t) => t.projectId));
    const ps = proyectos.filter((p) => ids.has(p.id));
    if (!ps.length) return [];
    return ps[0].statuses.filter((s) => ps.every((p) => p.statuses.some((x) => x.key === s.key)));
  }, [tareas, proyectos]);

  // Sprints que admiten a todas: globales, o del proyecto/equipo común.
  const sprintsValidos = useMemo(() => {
    const pids = new Set(tareas.map((t) => t.projectId));
    const teams = new Set(proyectos.filter((p) => pids.has(p.id)).map((p) => p.teamId));
    return sprints.filter((s) => s.status !== 'CLOSED' && (s.projectId ? pids.size === 1 && pids.has(s.projectId) : s.teamId ? teams.size === 1 && teams.has(s.teamId) : true));
  }, [tareas, proyectos, sprints]);

  async function aplicar(cambio: Omit<BulkUpdateTasksDto, 'ids'>, que: string) {
    setGuardando(true);
    try {
      const r = await tareasGateway.editarEnBloque({ ids: tareas.map((t) => t.id), ...cambio });
      const fallos = r.errors.map((e) => `${e.key}: ${e.error}`).join(' · ');
      hecho(`${que}: ${r.updated} de ${tareas.length} tareas${fallos ? ` · no se pudo en ${fallos}` : ''}.`);
      if (!r.errors.length) limpiar();
    } catch (e) {
      hecho(`⚠ ${(e as Error).message}`);
    } finally {
      setGuardando(false);
    }
  }

  const etq = etiqueta.trim().toLowerCase();
  return (
    <div className="bulk-bar">
      <span className="fw-semibold small text-nowrap">{tareas.length} seleccionadas</span>
      <Form.Select size="sm" value="" disabled={guardando || !estados.length} onChange={(e) => e.target.value && void aplicar({ statusKey: e.target.value }, 'Estado cambiado')} title={estados.length ? '' : 'Los proyectos seleccionados no comparten estados'}>
        <option value="">Estado…</option>
        {estados.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
      </Form.Select>
      <Form.Select size="sm" value="" disabled={guardando} onChange={(e) => e.target.value && void aplicar({ assigneeId: e.target.value === 'none' ? null : Number(e.target.value) }, 'Responsable cambiado')}>
        <option value="">Responsable…</option>
        <option value="none">Sin asignar</option>
        {equipo.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </Form.Select>
      <Form.Select size="sm" value="" disabled={guardando} onChange={(e) => e.target.value && void aplicar({ sprintId: e.target.value === 'none' ? null : Number(e.target.value) }, 'Sprint cambiado')}>
        <option value="">Sprint…</option>
        <option value="none">Backlog (sin sprint)</option>
        {sprintsValidos.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Form.Select>
      <Form.Select size="sm" value="" disabled={guardando} onChange={(e) => e.target.value && void aplicar({ priority: e.target.value as Priority }, 'Prioridad cambiada')}>
        <option value="">Prioridad…</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
      </Form.Select>
      <Form.Select size="sm" value="" disabled={guardando} onChange={(e) => e.target.value && void aplicar({ addFollowerIds: [Number(e.target.value)] }, 'Seguimiento añadido')}>
        <option value="">Añadir seguimiento…</option>
        {equipo.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </Form.Select>
      <div className="d-flex gap-1">
        <Form.Control size="sm" placeholder="etiqueta" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} style={{ width: 110 }} />
        <Button size="sm" variant="outline-secondary" disabled={guardando || !etq} onClick={() => void aplicar({ addTags: [etq] }, `Etiqueta «${etq}» añadida`).then(() => setEtiqueta(''))} title="Añadir la etiqueta">+</Button>
        <Button size="sm" variant="outline-secondary" disabled={guardando || !etq} onClick={() => void aplicar({ removeTags: [etq] }, `Etiqueta «${etq}» quitada`).then(() => setEtiqueta(''))} title="Quitar la etiqueta">−</Button>
      </div>
      {guardando && <Spinner size="sm" animation="border" />}
      <Button size="sm" variant="link" className="p-0 ms-auto" onClick={limpiar}>quitar selección</Button>
    </div>
  );
}
