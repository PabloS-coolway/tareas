import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import type { Feature } from '@yorga/contracts';
import { useAuth } from './AuthContext';

/** Protege las rutas hijas: exige sesión; si no hay, redirige a /login. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Spinner animation="border" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/**
 * REQ-006 · Protege rutas que exigen una FEATURE. Es sólo UX (la puerta real es el guard de la API): si el
 * rol no tiene la feature, se redirige al inicio en vez de enseñar una pantalla que la API va a rechazar.
 */
export function RequireFeature({ feature }: { feature: Feature }) {
  const { hasFeature } = useAuth();
  if (!hasFeature(feature)) return <Navigate to="/inicio" replace />;
  return <Outlet />;
}
