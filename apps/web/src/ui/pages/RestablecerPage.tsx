import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { BoxSeamFill } from 'react-bootstrap-icons';
import { Link, useSearchParams } from 'react-router-dom';
import { authGateway } from '../composition';

/** Nueva contraseña con el token del enlace del correo. */
export function RestablecerPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [hecho, setHecho] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (p1 !== p2) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    try {
      await authGateway.restablecer(token, p1);
      setHecho(true);
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
          <div className="login-brand mb-3"><BoxSeamFill className="me-2" /><span>Tareas</span><span className="brand-chip">Yorga</span></div>
          <h1 className="h5 mb-1">Nueva contraseña</h1>
          {!token ? (
            <Alert variant="warning" className="small">Falta el enlace. <Link to="/olvide">Pide uno nuevo</Link>.</Alert>
          ) : hecho ? (
            <>
              <Alert variant="success" className="small">Contraseña cambiada. Ya puedes entrar.</Alert>
              <Link to="/login" className="btn btn-brand w-100">Ir al acceso</Link>
            </>
          ) : (
            <>
              <p className="text-secondary small mb-4">Al menos 6 caracteres.</p>
              {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
              <Form onSubmit={onSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label className="small">Contraseña nueva</Form.Label>
                  <Form.Control type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} required minLength={6} autoFocus />
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label className="small">Repítela</Form.Label>
                  <Form.Control type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} required minLength={6} />
                </Form.Group>
                <Button type="submit" className="btn-brand w-100" disabled={busy}>{busy ? <Spinner as="span" size="sm" animation="border" /> : 'Guardar'}</Button>
              </Form>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
