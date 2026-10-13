import { useNavigate } from 'react-router-dom';

/**
 * Volver atrás dentro de la app (instalada como PWA no hay botón del navegador). Si se entró directo por un
 * enlace compartido no hay a dónde volver: se va al inicio.
 */
export function useVolver(): () => void {
  const navigate = useNavigate();
  return () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/inicio'));
}
