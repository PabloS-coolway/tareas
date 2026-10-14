import { useEffect, useState } from 'react';
import { Alert, Button, Card } from 'react-bootstrap';
import { Key } from 'react-bootstrap-icons';
import type { PerfilCorreoDto } from '@yorga/contracts';
import { correoGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { useProyectos } from '../proyectos/ProyectosContext';
import { CambiarPasswordModal } from '../auth/CambiarPasswordModal';
import { Avatar } from '../components/tareas-ui';
import { Skeleton } from '../components/Skeleton';
import { PreferenciasCorreo } from '../components/PreferenciasCorreo';

/** Mi perfil: mis datos, cambiar contraseña y mis preferencias de correo. */
export function PerfilPage() {
  const { user } = useAuth();
  const { proyectos } = useProyectos();
  const [perfil, setPerfil] = useState<PerfilCorreoDto | null>(null);
  const [error, setError] = useState('');
  const [cambiarPass, setCambiarPass] = useState(false);

  useEffect(() => {
    correoGateway.misPreferencias().then(setPerfil).catch((e) => setError((e as Error).message));
  }, []);

  if (!user) return null;

  return (
    <div className="page">
      <header className="page-head mb-4">
        <h1 className="h4 mb-1">Mi perfil</h1>
      </header>

      <Card className="mb-4">
        <Card.Body className="d-flex align-items-center gap-3 flex-wrap">
          <Avatar user={user} size="lg" />
          <div className="me-auto">
            <div className="fw-semibold">{user.name}</div>
            <div className="text-secondary small">{user.email} · {user.role}</div>
          </div>
          <Button variant="outline-secondary" onClick={() => setCambiarPass(true)}><Key className="me-1" /> Cambiar contraseña</Button>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title className="mb-1">Correo</Card.Title>
          <p className="text-secondary small">Qué avisos te llegan también por correo. En la campana de la app los sigues viendo todos.</p>
          {error && <Alert variant="danger">⚠ {error}</Alert>}
          {perfil && !perfil.avisosCorreoActivos && (
            <Alert variant="warning" className="small">Ahora mismo los avisos por correo están desactivados para todo el equipo (lo decide un admin en «Correo»). Puedes dejar tus preferencias listas.</Alert>
          )}
          {!perfil && !error ? (
            <Skeleton className="skeleton-rounded" width="100%" height={260} />
          ) : (
            perfil && (
              <PreferenciasCorreo
                valor={perfil.preferencias}
                catalogo={perfil.catalogo}
                ambitos={proyectos.filter((p) => !p.archived).map((p) => ({ id: p.id, nombre: p.name }))}
                nombreAmbitos="proyectos"
                niveles={perfil.niveles}
                nombreNivel="prioridad"
                horarioResumen={perfil.horarioResumen}
                onGuardar={async (v) => setPerfil(await correoGateway.guardarMisPreferencias(v))}
              />
            )
          )}
        </Card.Body>
      </Card>
      {cambiarPass && <CambiarPasswordModal onClose={() => setCambiarPass(false)} />}
    </div>
  );
}
