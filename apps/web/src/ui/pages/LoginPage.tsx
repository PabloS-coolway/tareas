import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { BoxSeamFill } from 'react-bootstrap-icons';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Pantalla de acceso. Si ya hay sesión, redirige a la app. */
export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/inicio';
  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password, remember);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <Card className="login-card">
        <Card.Body className="p-4">
          <div className="login-brand mb-3">
            <BoxSeamFill className="me-2" />
            <span>Tareas</span>
            <span className="brand-chip">Yorga</span>
          </div>
          <h1 className="h5 mb-1">Acceso</h1>
          <p className="text-secondary small mb-4">Gestor de tareas del Grupo Yorga.</p>

          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3">
              <Form.Label className="small">Email</Form.Label>
              <Form.Control
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="small">Contraseña</Form.Label>
              <Form.Control
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Form.Group>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <Form.Check type="checkbox" id="lg-remember" className="small" label="Recordarme 30 días" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <Link to="/olvide" className="small">¿Has olvidado tu contraseña?</Link>
            </div>
            <Button type="submit" className="btn-brand w-100" disabled={busy}>
              {busy ? (
                <>
                  <Spinner as="span" size="sm" animation="border" className="me-2" /> Entrando…
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
