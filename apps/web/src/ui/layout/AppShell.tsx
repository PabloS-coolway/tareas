import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Bell, KanbanFill, List, Search } from 'react-bootstrap-icons';
import { Sidebar } from './Sidebar';
import { useTheme } from '../useTheme';
import { ProyectosProvider } from '../proyectos/ProyectosContext';
import { Paleta } from '../components/Paleta';

/**
 * Marco de la app: sidebar fijo + área de contenido (las páginas se renderizan en el Outlet).
 * En el móvil el sidebar es un panel que se abre con el botón de menú de la barra superior.
 */
export function AppShell() {
  const { theme, setTheme } = useTheme();
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();

  // Al navegar, el panel del móvil se cierra solo.
  useEffect(() => setMenu(false), [pathname]);

  return (
    <ProyectosProvider>
      <div className={`shell ${menu ? 'menu-abierto' : ''}`}>
        <header className="topbar-movil">
          <button type="button" className="topbar-btn" onClick={() => setMenu((m) => !m)} aria-label="Menú" aria-expanded={menu}>
            <List />
          </button>
          <Link to="/inicio" className="topbar-marca"><KanbanFill className="me-2" />Tareas</Link>
          <button type="button" className="topbar-btn ms-auto" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))} aria-label="Buscar">
            <Search />
          </button>
          <Link to="/avisos" className="topbar-btn" aria-label="Avisos"><Bell /></Link>
        </header>
        <Sidebar theme={theme} setTheme={setTheme} />
        {menu && <div className="menu-velo" onClick={() => setMenu(false)} aria-hidden="true" />}
        <main className="content">
          <Outlet />
        </main>
      </div>
      <Paleta />
    </ProyectosProvider>
  );
}
