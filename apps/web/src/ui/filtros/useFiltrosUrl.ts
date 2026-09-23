import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { escribirFiltros, filtrosActivos, hayFiltros, leerFiltros, type Filtros } from './filtros-url';

const MEMORIA = 'tareas.filtros.';

function leerMemoria(clave: string): string | null {
  try {
    return localStorage.getItem(MEMORIA + clave);
  } catch {
    return null;
  }
}

function guardarMemoria(clave: string, query: string): void {
  try {
    localStorage.setItem(MEMORIA + clave, query);
  } catch {
    /* sin almacenamiento (modo privado): la URL sigue funcionando */
  }
}

/**
 * Filtros de una página guardados en la URL. Si se entra sin filtros en la URL, recupera los últimos que
 * se usaron en esa página (`memoria`, p. ej. `p/COOL`). `cambiar` es estable: se puede usar en `useMemo`.
 */
export function useFiltrosUrl<T extends Filtros>(defaults: T, memoria: string) {
  const [params, setParams] = useSearchParams();
  const filtros = useMemo(() => leerFiltros(params, defaults), [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const ref = useRef({ params, setParams, memoria });
  ref.current = { params, setParams, memoria };

  // Al entrar (o al cambiar de proyecto) sin filtros en la URL: los últimos usados aquí.
  useEffect(() => {
    if (hayFiltros(params, defaults)) return;
    const guardados = leerMemoria(memoria);
    if (guardados) setParams(escribirFiltros(leerFiltros(new URLSearchParams(guardados), defaults), defaults, params), { replace: true });
  }, [memoria]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = useCallback((cambios: Partial<T>) => {
    const { params: actuales, setParams: set, memoria: clave } = ref.current;
    const siguientes = escribirFiltros({ ...leerFiltros(actuales, defaults), ...cambios }, defaults, actuales);
    guardarMemoria(clave, escribirFiltros(leerFiltros(siguientes, defaults), defaults).toString());
    ref.current.params = siguientes; // dos cambios seguidos antes de repintar no se pisan
    set(siguientes, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const limpiar = useCallback(() => cambiar(defaults), [cambiar]); // eslint-disable-line react-hooks/exhaustive-deps

  return { filtros, cambiar, limpiar, activos: filtrosActivos(filtros, defaults) };
}
