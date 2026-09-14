import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ProjectDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';

interface ProyectosState {
  proyectos: ProjectDto[];
  loading: boolean;
  /** Vuelve a pedir la lista (tras crear/archivar un proyecto). */
  reload: () => Promise<void>;
}

const Ctx = createContext<ProyectosState | null>(null);

/** Lista de proyectos compartida por el menú lateral y las páginas (se carga una vez por sesión). */
export function ProyectosProvider({ children }: { children: ReactNode }) {
  const [proyectos, setProyectos] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    void reload();
  }, [reload]);

  return <Ctx.Provider value={{ proyectos, loading, reload }}>{children}</Ctx.Provider>;
}

export function useProyectos(): ProyectosState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProyectos debe usarse dentro de <ProyectosProvider>.');
  return ctx;
}
