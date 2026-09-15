import { NavLink, useLocation } from 'react-router-dom';
import { BoxArrowRight, HouseDoorFill, Key, Bell, Flag, JournalText, KanbanFill, ListCheck, ListUl, People, Search, PeopleFill, PersonCircle, Plugin, ShieldLock } from 'react-bootstrap-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { tareasGateway } from '../composition';
import type { Feature } from '@yorga/contracts';
import { Button } from 'react-bootstrap';
import { ThemeSwitcher } from './ThemeSwitcher';
import type { Theme } from '../useTheme';
import { useAuth } from '../auth/AuthContext';
import { CambiarPasswordModal } from '../auth/CambiarPasswordModal';
import { useProyectos } from '../proyectos/ProyectosContext';

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
    { to: '/sprints', label: 'Sprints', icon: <Flag /> },
    { to: '/avisos', label: 'Avisos', icon: <Bell />, badge: sinLeer },
  ];
  const admin: NavItem[] = [
    { to: '/usuarios', label: 'Usuarios', icon: <People />, feature: 'usuarios.gestionar' },
    { to: '/roles', label: 'Roles', icon: <ShieldLock />, feature: 'roles.gestionar' },
    { to: '/plantillas', label: 'Plantillas', icon: <JournalText /> },
    { to: '/tokens', label: 'Tokens de API', icon: <Plugin /> },
  ];
  const visibles = (items: NavItem[]) => items.filter((n) => !n.feature || hasFeature(n.feature));
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
          {proyectos.map((p) => (
            <NavLink key={p.id} to={`/p/${p.key}`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={p.name}>
              <span className="nav-ico"><span className="nav-proj-dot" style={{ background: p.color }} /></span>
              <span className="nav-label text-truncate">{p.name}</span>
              {p.mineDoingCount > 0 && <span className="badge bg-light text-dark rounded-pill ms-auto" title={`${p.mineDoingCount} tuyas en curso`}>{p.mineDoingCount}</span>}
            </NavLink>
          ))}
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
