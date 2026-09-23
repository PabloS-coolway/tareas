import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChatLeftText, Paperclip } from 'react-bootstrap-icons';
import { PRIORITY_LABELS, TASK_TYPE_LABELS, type Priority, type ProjectStatusDto, type TaskDto, type TaskType, type UserRefDto } from '@yorga/contracts';

// ---------- Fechas ----------

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 2026-09-14 → "14 sep" (o "14 sep 2025" si no es el año actual). */
export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const base = `${d.getDate()} ${MESES[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function fmtFechaHora(iso: string): string {
  const d = new Date(iso);
  return `${fmtFecha(iso)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "hace 5 min", "hace 3 h", "hace 2 días" o la fecha si es antigua. */
export function hace(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 14) return `hace ${d} día${d === 1 ? '' : 's'}`;
  return fmtFecha(iso);
}

function diasHasta(iso: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - hoy.getTime()) / 86_400_000);
}

/** Fecha de vencimiento con semáforo: pasada (rojo), esta semana (naranja). */
export function Vence({ date, done }: { date: string | null; done?: boolean }) {
  if (!date) return null;
  const d = diasHasta(date);
  const cls = done ? '' : d < 0 ? 'late' : d <= 3 ? 'soon' : '';
  const title = d === 0 ? 'vence hoy' : d < 0 ? `venció hace ${-d} día${d === -1 ? '' : 's'}` : `vence en ${d} día${d === 1 ? '' : 's'}`;
  return (
    <span className={`vence ${cls}`} title={title}>
      {fmtFecha(date)}
    </span>
  );
}

// ---------- Personas ----------

const COLORES = ['#6d28d9', '#0f766e', '#b45309', '#1d4ed8', '#be185d', '#047857', '#7c2d12', '#4338ca', '#0e7490', '#9f1239'];

export function colorDe(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

export function iniciales(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ user, size, title }: { user: UserRefDto | null; size?: 'lg'; title?: string }) {
  if (!user) return <span className={`avatar empty ${size ?? ''}`} title={title ?? 'Sin asignar'}>–</span>;
  return (
    <span className={`avatar ${size ?? ''}`} style={{ background: colorDe(user.email) }} title={title ?? user.name}>
      {iniciales(user.name)}
    </span>
  );
}

// ---------- Etiquetas y puntos ----------

/** Etiquetas de una tarea como chips pequeños (máx. `max`, el resto como +n). */
export function Etiquetas({ tags, max = 3, onClick }: { tags: string[]; max?: number; onClick?: (tag: string) => void }) {
  if (!tags.length) return null;
  const vis = tags.slice(0, max);
  return (
    <span className="tags">
      {vis.map((t) =>
        onClick ? (
          <button key={t} type="button" className="tag" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(t); }} title={`Filtrar por ${t}`}>{t}</button>
        ) : (
          <span key={t} className="tag">{t}</span>
        ),
      )}
      {tags.length > max && <span className="tag more" title={tags.slice(max).join(', ')}>+{tags.length - max}</span>}
    </span>
  );
}

/** Puntos de estimación. */
export function Puntos({ n }: { n: number | null }) {
  if (n === null || n === undefined) return null;
  return <span className="pts" title={`${n} puntos`}>{n} pt</span>;
}

// ---------- Píldoras ----------

export function PrioridadPill({ p }: { p: Priority }) {
  return <span className={`pill prio-${p}`}>{PRIORITY_LABELS[p]}</span>;
}

export function TipoPill({ t }: { t: TaskType }) {
  return <span className={`pill tipo-${t}`}>{TASK_TYPE_LABELS[t]}</span>;
}

export function EstadoPill({ s }: { s: ProjectStatusDto }) {
  return (
    <span className="pill estado-pill" style={{ background: s.color }}>
      {s.name}
    </span>
  );
}

export function Subprogreso({ done, total }: { done: number; total: number }) {
  if (!total) return null;
  return (
    <span className="subprogress" title={`${done} de ${total} subtareas hechas`}>
      <span className="bar">
        <i style={{ width: `${Math.round((done / total) * 100)}%` }} />
      </span>
      <span>
        {done}/{total}
      </span>
    </span>
  );
}

// ---------- Tarjeta del tablero ----------

/** Fuera del plazo de respuesta: sigue «por hacer» pasado su límite. */
export function fueraDePlazo(t: TaskDto, ahora = Date.now()): boolean {
  return !!t.slaDue && t.status.category === 'TODO' && new Date(t.slaDue).getTime() <= ahora;
}

export function PlazoPill({ task }: { task: TaskDto }) {
  if (!fueraDePlazo(task)) return null;
  return <span className="pill sla" title={`Sin empezar desde ${fmtFechaHora(task.createdAt)}: plazo de respuesta vencido ${fmtFechaHora(task.slaDue!)}`}>⏱ fuera de plazo</span>;
}

export function TaskCard({ task, dragging, extra }: { task: TaskDto; dragging?: boolean; extra?: ReactNode }) {
  const done = task.status.category === 'DONE';
  return (
    <Link to={`/t/${task.key}`} className={`board-card ${dragging ? 'dragging' : ''}`}>
      <div className="d-flex align-items-center gap-2">
        <span className="task-key">{task.key}</span>
        {task.type !== 'TASK' && <TipoPill t={task.type} />}
        {task.parentKey && (
          <span className="task-key text-truncate" title={task.parentTitle ?? ''}>
            ↳ {task.parentKey}
          </span>
        )}
        <span className="ms-auto">
          <Avatar user={task.assignee} />
        </span>
      </div>
      <div className="title">{task.title}</div>
      <Etiquetas tags={task.tags} />
      <div className="meta">
        <PlazoPill task={task} />
        {task.blockedByOpenCount > 0 && <span className="pill blocked" title={`Bloqueada por ${task.blockedByOpenCount} tarea(s) sin terminar`}>⛔ {task.blockedByOpenCount}</span>}
        {task.priority !== 'NORMAL' && <PrioridadPill p={task.priority} />}
        <Puntos n={task.estimate} />
        <Vence date={task.dueDate} done={done} />
        <Subprogreso done={task.doneSubtaskCount} total={task.subtaskCount} />
        <span className="right">
          {task.commentCount > 0 && (
            <span title={`${task.commentCount} comentarios`}>
              <ChatLeftText /> {task.commentCount}
            </span>
          )}
          {task.attachmentCount > 0 && (
            <span title={`${task.attachmentCount} adjuntos`}>
              <Paperclip /> {task.attachmentCount}
            </span>
          )}
        </span>
      </div>
      {extra}
    </Link>
  );
}

/** Fila compacta (mis tareas, listados). */
export function TaskRow({ task, showProject }: { task: TaskDto; showProject?: boolean }) {
  return (
    <Link to={`/t/${task.key}`} className="task-row">
      <span className="task-key">{task.key}</span>
      <span className="title">
        {showProject && <span className="text-secondary me-1">{task.projectKey} ·</span>}
        {task.title}
        {task.tags.length > 0 && <span className="ms-2 hide-sm"><Etiquetas tags={task.tags} max={2} /></span>}
      </span>
      <span className="hide-sm">
        <EstadoPill s={task.status} />
      </span>
      <span className="hide-sm">{task.blockedByOpenCount > 0 && <span className="pill blocked" title="Bloqueada">⛔</span>}{task.priority !== 'NORMAL' ? <PrioridadPill p={task.priority} /> : null}</span>
      <span className="small">
        <Vence date={task.dueDate} done={task.status.category === 'DONE'} />
      </span>
    </Link>
  );
}
