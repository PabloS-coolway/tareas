import { NavLink, useLocation, useParams } from 'react-router-dom';
import { BoxArrowRight, HouseDoorFill, Key, Activity, BarChartLine, Bell, Diagram3, Flag, JournalText, Layers, KanbanFill, ListCheck, ListUl, People, Search, PeopleFill, PersonCircle, Plugin, ShieldLock, Collection, Eye, EyeSlash, Calendar3, Lightning, Stopwatch } from 'react-bootstrap-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { tareasGateway } from '../composition';
import type { Feature } from '@yorga/contracts';
import { Button } from 'react-bootstrap';
import { ThemeSwitcher } from './ThemeSwitcher';
import type { Theme } from '../useTheme';
import { useAuth } from '../auth/AuthContext';
import { CambiarPasswordModal } from '../auth/CambiarPasswordModal';
import { useProyectos } from '../proyectos/ProyectosContext';
import { proyectosDelMenu } from './menu-proyectos';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Si se declara, la entrada sólo se ve con esa feature. */
  feature?: Feature;
  end?: boolean;
  /** Contador (avisos sin leer). */
  badge?: number;
}

/** Recuerda si el menú enseña sólo los proyectos con tareas mías. Por defecto sí, salvo para quien ve todo. */
const CLAVE_SOLO_MIOS = 'tareas.menu-solo-mios';

/** Evento para refrescar el contador de avisos (lo lanza la página de avisos al marcar leídos). */
export const EVENTO_AVISOS = 'avisos:cambio';
export function avisarAvisosLeidos(): void {
  window.dispatchEvent(new Event(EVENTO_AVISOS));
}

export function Sidebar({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const { user, logout, hasFeature } = useAuth();
  const { proyectos } = useProyectos();
  const [cambiarPass, setCambiarPass] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);
  const { pathname } = useLocation();
  const { key: claveRuta } = useParams();
  const [soloMios, setSoloMios] = useState(() => {
    const guardado = localStorage.getItem(CLAVE_SOLO_MIOS);
    return guardado === null ? !hasFeature('tareas.ver-todo') : guardado === '1';
  });
  const cambiarSoloMios = (v: boolean) => {
    setSoloMios(v);
    localStorage.setItem(CLAVE_SOLO_MIOS, v ? '1' : '0');
  };

  useEffect(() => {
    const refrescar = () => tareasGateway.avisosSinLeer().then(setSinLeer).catch(() => undefined);
    void refrescar();
    const t = setInterval(refrescar, 60_000);
    window.addEventListener(EVENTO_AVISOS, refrescar);
    return () => {
      clearInterval(t);
      window.removeEventListener(EVENTO_AVISOS, refrescar);
    };
  }, [pathname]);

  const principal: NavItem[] = [
    { to: '/inicio', label: 'Inicio', icon: <HouseDoorFill /> },
    { to: '/mis-tareas', label: 'Mis tareas', icon: <ListCheck /> },
    { to: '/equipo', label: 'Equipo', icon: <PeopleFill /> },
    { to: '/backlog', label: 'Planificación', icon: <Layers /> },
    { to: '/sprints', label: 'Sprints', icon: <Flag /> },
    { to: '/calendario', label: 'Calendario', icon: <Calendar3 /> },
    { to: '/avisos', label: 'Avisos', icon: <Bell />, badge: sinLeer },
    { to: '/actividad', label: 'Actividad', icon: <Activity /> },
  ];
  const admin: NavItem[] = [
    { to: '/usuarios', label: 'Usuarios', icon: <People />, feature: 'usuarios.gestionar' },
    { to: '/roles', label: 'Roles', icon: <ShieldLock />, feature: 'roles.gestionar' },
    { to: '/panel', label: 'Panel del equipo', icon: <BarChartLine />, feature: 'proyectos.gestionar' },
    { to: '/equipos', label: 'Equipos', icon: <Collection />, feature: 'equipos.gestionar' },
    { to: '/plantillas', label: 'Plantillas', icon: <JournalText /> },
    { to: '/reglas', label: 'Reglas', icon: <Lightning /> },
    { to: '/formularios', label: 'Formularios y plazos', icon: <Stopwatch />, feature: 'proyectos.gestionar' },
    { to: '/tokens', label: 'Tokens de API', icon: <Plugin /> },
    { to: '/integraciones', label: 'Integraciones', icon: <Diagram3 />, feature: 'usuarios.gestionar' },
  ];
  const visibles = (items: NavItem[]) => items.filter((n) => !n.feature || hasFeature(n.feature));
  const listados = proyectosDelMenu(proyectos, soloMios, claveRuta);
  const ocultos = proyectos.length - listados.length;
  // Proyectos agrupados por equipo (si sólo hay uno, sin título). Los sin equipo van al final.
  const grupos = (() => {
    const m = new Map<string, { key: string; name: string; items: typeof proyectos }>();
    for (const p of listados) {
      const k = p.teamKey ?? '_';
      if (!m.has(k)) m.set(k, { key: k, name: p.teamName ?? 'Sin equipo', items: [] });
      m.get(k)!.items.push(p);
    }
    return [...m.values()].sort((a, b) => (a.key === '_' ? 1 : 0) - (b.key === '_' ? 1 : 0) || a.name.localeCompare(b.name));
  })();
  const item = (n: NavItem) => (
    <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="nav-ico">{n.icon}</span>
      <span className="nav-label">{n.label}</span>
      {n.badge ? <span className="badge bg-danger rounded-pill ms-auto">{n.badge}</span> : null}
    </NavLink>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <KanbanFill className="me-2" />
        <span>Tareas</span>
        <span className="brand-chip">Yorga</span>
      </div>

      <nav className="sidebar-nav">
        <button type="button" className="nav-item nav-search" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))} title="Buscar (Ctrl+K)">
          <span className="nav-ico"><Search /></span>
          <span className="nav-label">Buscar</span>
          <kbd className="ms-auto">Ctrl K</kbd>
        </button>
        <div className="nav-group">{principal.map(item)}</div>

        <div className="nav-group">
          <div className="nav-group-title">Proyectos</div>
          <NavLink to="/proyectos" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-ico"><KanbanFill /></span>
            <span className="nav-label">Todos los proyectos</span>
          </NavLink>
          <NavLink to="/tareas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-ico"><ListUl /></span>
            <span className="nav-label">Todas las tareas</span>
          </NavLink>
          {grupos.map((g) => (
            <div key={g.key} className="nav-subgroup">
              {grupos.length > 1 && <div className="nav-subgroup-title">{g.name}</div>}
              {g.items.map((p) => (
                <NavLink key={p.id} to={`/p/${p.key}`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={p.name}>
                  <span className="nav-ico"><span className="nav-proj-dot" style={{ background: p.color }} /></span>
                  <span className="nav-label text-truncate">{p.name}</span>
                  {p.mineDoingCount > 0 && <span className="badge bg-light text-dark rounded-pill ms-auto" title={`${p.mineDoingCount} tuyas en curso`}>{p.mineDoingCount}</span>}
                </NavLink>
              ))}
            </div>
          ))}
          {(ocultos > 0 || !soloMios) && (
            <button type="button" className="nav-item nav-filtro" onClick={() => cambiarSoloMios(!soloMios)}>
              <span className="nav-ico">{soloMios ? <Eye /> : <EyeSlash />}</span>
              <span className="nav-label">{soloMios ? `Ver todos (${ocultos} más)` : 'Ver sólo los míos'}</span>
            </button>
          )}
        </div>

        <div className="nav-group">
          <div className="nav-group-title">Administración</div>
          {visibles(admin).map(item)}
        </div>
      </nav>

      <div className="sidebar-foot">
        {user && (
          <div className="sidebar-user">
            <PersonCircle className="sidebar-user-ico" />
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name}</div>
              <div className="sidebar-user-role">{user.role}</div>
            </div>
            <Button variant="link" size="sm" className="sidebar-logout" onClick={() => setCambiarPass(true)} title="Cambiar contraseña" aria-label="Cambiar contraseña">
              <Key />
            </Button>
            <Button variant="link" size="sm" className="sidebar-logout" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
              <BoxArrowRight />
            </Button>
          </div>
        )}
        <ThemeSwitcher theme={theme} setTheme={setTheme} />
        <div className="mt-2">Grupo Yorga · Tareas</div>
      </div>
      {cambiarPass && <CambiarPasswordModal onClose={() => setCambiarPass(false)} />}
    </aside>
  );
}
