import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { ProjectDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';

interface ProyectosState {
  proyectos: ProjectDto[];
  loading: boolean;
  /** Vuelve a pedir la lista (tras crear/archivar un proyecto). */
  reload: () => Promise<void>;
}

const Ctx = createContext<ProyectosState | null>(null);

/** Evento que lanza el gateway cuando una tarea cambia (alta, edición, movimiento, borrado, import). */
export const EVENTO_TAREAS_CAMBIO = 'tareas:cambio';
export function avisarCambioTareas(): void {
  window.dispatchEvent(new Event(EVENTO_TAREAS_CAMBIO));
}

/**
 * Lista de proyectos compartida por el menú lateral y las páginas. Los contadores (abiertas / mías) se
 * refrescan en silencio al cambiar de página y cuando alguna tarea cambia, para que el menú no se quede viejo.
 */
export function ProyectosProvider({ children }: { children: ReactNode }) {
  const [proyectos, setProyectos] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const { pathname } = useLocation();
  const primera = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setProyectos(await tareasGateway.proyectos());
    } catch {
      setProyectos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Refresco silencioso: sin `loading`, para no parpadear el menú. */
  const refrescar = useCallback(async () => {
    try {
      setProyectos(await tareasGateway.proyectos());
    } catch {
      /* se mantiene lo que había */
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    void refrescar();
  }, [pathname, refrescar]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onCambio = () => {
      clearTimeout(t);
      t = setTimeout(() => void refrescar(), 400); // agrupa ráfagas (p. ej. varios movimientos seguidos)
    };
    window.addEventListener(EVENTO_TAREAS_CAMBIO, onCambio);
    return () => {
      clearTimeout(t);
      window.removeEventListener(EVENTO_TAREAS_CAMBIO, onCambio);
    };
  }, [refrescar]);

  return <Ctx.Provider value={{ proyectos, loading, reload }}>{children}</Ctx.Provider>;
}

export function useProyectos(): ProyectosState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProyectos debe usarse dentro de <ProyectosProvider>.');
  return ctx;
}
