import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'react-bootstrap';
import { Search } from 'react-bootstrap-icons';
import type { SprintDto, TaskDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useProyectos } from '../proyectos/ProyectosContext';
import { EstadoPill } from './tareas-ui';

interface Entrada {
  id: string;
  grupo: 'Ir a' | 'Proyectos' | 'Sprints' | 'Tareas';
  texto: string;
  detalle?: string;
  to: string;
  task?: TaskDto;
}

const PAGINAS: Entrada[] = [
  { id: 'p-inicio', grupo: 'Ir a', texto: 'Inicio', to: '/inicio' },
  { id: 'p-mis', grupo: 'Ir a', texto: 'Mis tareas', to: '/mis-tareas' },
  { id: 'p-equipo', grupo: 'Ir a', texto: 'Equipo', to: '/equipo' },
  { id: 'p-backlog', grupo: 'Ir a', texto: 'Planificación (backlog y sprints)', to: '/backlog' },
  { id: 'p-sprints', grupo: 'Ir a', texto: 'Sprints', to: '/sprints' },
  { id: 'p-todas', grupo: 'Ir a', texto: 'Todas las tareas', to: '/tareas' },
  { id: 'p-proyectos', grupo: 'Ir a', texto: 'Proyectos', to: '/proyectos' },
  { id: 'p-avisos', grupo: 'Ir a', texto: 'Avisos', to: '/avisos' },
  { id: 'p-actividad', grupo: 'Ir a', texto: 'Actividad', to: '/actividad' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Paleta de búsqueda (Ctrl+K / Cmd+K): tareas por texto o clave, proyectos, sprints y páginas. */
export function Paleta() {
  const navigate = useNavigate();
  const { proyectos } = useProyectos();
  const [abierta, setAbierta] = useState(false);
  const [q, setQ] = useState('');
  const [tareas, setTareas] = useState<TaskDto[]>([]);
  const [sprints, setSprints] = useState<SprintDto[]>([]);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierta((a) => !a);
      }
      if (e.key === 'Escape') setAbierta(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!abierta) return;
    setQ('');
    setTareas([]);
    setSel(0);
    tareasGateway.sprints().then(setSprints).catch(() => setSprints([]));
  }, [abierta]);

  useEffect(() => {
    if (!abierta || q.trim().length < 2) {
      setTareas([]);
      return;
    }
    const t = setTimeout(() => {
      tareasGateway
        .tareas({ q: q.trim(), includeDone: true, pageSize: 12 })
        .then((p) => setTareas(p.items))
        .catch(() => setTareas([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, abierta]);

  const entradas = useMemo<Entrada[]>(() => {
    const nq = norm(q.trim());
    const coincide = (s: string) => !nq || norm(s).includes(nq);
    const ps: Entrada[] = proyectos.filter((p) => coincide(`${p.key} ${p.name}`)).map((p) => ({ id: `pr-${p.id}`, grupo: 'Proyectos', texto: p.name, detalle: p.key, to: `/p/${p.key}` }));
    const ss: Entrada[] = sprints.filter((s) => coincide(s.name)).map((s) => ({ id: `sp-${s.id}`, grupo: 'Sprints', texto: s.name, detalle: `${s.done}/${s.total}`, to: `/sprints/${s.id}` }));
    const pg = PAGINAS.filter((p) => coincide(p.texto));
    const ts: Entrada[] = tareas.map((t) => ({ id: `t-${t.id}`, grupo: 'Tareas', texto: t.title, detalle: t.key, to: `/t/${t.key}`, task: t }));
    return [...ts, ...ps.slice(0, 5), ...ss.slice(0, 5), ...pg];
  }, [q, proyectos, sprints, tareas]);

  useEffect(() => setSel(0), [entradas.length, q]);

  const ir = (e: Entrada) => {
    setAbierta(false);
    navigate(e.to);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, entradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && entradas[sel]) {
      e.preventDefault();
      ir(entradas[sel]);
    }
  }

  let grupoPrevio = '';
  return (
    <Modal show={abierta} onHide={() => setAbierta(false)} onEntered={() => inputRef.current?.focus()} dialogClassName="paleta" backdropClassName="paleta-backdrop">
      <div className="paleta-input">
        <Search className="text-secondary" />
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} placeholder="Buscar tarea, clave (COOL-12), proyecto, sprint o página…" aria-label="Buscar" />
        <kbd>esc</kbd>
      </div>
      <div className="paleta-list">
        {entradas.length === 0 && <div className="text-secondary small p-3">{q.trim().length < 2 ? 'Escribe para buscar.' : 'Sin resultados.'}</div>}
        {entradas.map((e, i) => {
          const cab = e.grupo !== grupoPrevio;
          grupoPrevio = e.grupo;
          return (
            <div key={e.id}>
              {cab && <div className="paleta-grupo">{e.grupo}</div>}
              <button type="button" className={`paleta-item ${i === sel ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => ir(e)}>
                {e.detalle && <span className="task-key">{e.detalle}</span>}
                <span className="texto">{e.texto}</span>
                {e.task && <EstadoPill s={e.task.status} />}
              </button>
            </div>
          );
        })}
      </div>
      <div className="paleta-foot">↑↓ moverse · Enter abrir · Ctrl+K abrir/cerrar</div>
    </Modal>
  );
}
