import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { BoxSeamFill } from 'react-bootstrap-icons';
import { Link } from 'react-router-dom';
import { authGateway } from '../composition';

/** "He olvidado mi contraseña": pide el email. Con correo configurado llega un enlace; si no, avisa a un admin. */
export function OlvidePage() {
  const [email, setEmail] = useState('');
  const [hecho, setHecho] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conCorreo, setConCorreo] = useState<boolean | null>(null);

  useEffect(() => {
    authGateway.olvideInfo().then((i) => setConCorreo(i.email)).catch(() => setConCorreo(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authGateway.olvide(email);
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
          <h1 className="h5 mb-1">Recuperar contraseña</h1>
          {hecho ? (
            <>
              <Alert variant="success" className="small">
                {conCorreo
                  ? 'Si ese email está registrado, te hemos enviado un enlace para poner una contraseña nueva. Caduca en 1 hora; mira también el spam.'
                  : 'Hemos avisado a los administradores. Te enviarán una contraseña temporal por privado; cámbiala al entrar.'}
              </Alert>
              <Link to="/login" className="small">Volver al acceso</Link>
            </>
          ) : (
            <>
              <p className="text-secondary small mb-4">
                {conCorreo === false
                  ? 'Escribe tu email y avisaremos a un administrador para que te ponga una contraseña nueva.'
                  : 'Escribe tu email y te enviaremos un enlace para poner una contraseña nueva.'}
              </p>
              {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
              <Form onSubmit={onSubmit}>
                <Form.Group className="mb-4">
                  <Form.Label className="small">Email</Form.Label>
                  <Form.Control type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </Form.Group>
                <Button type="submit" className="btn-brand w-100" disabled={busy}>{busy ? <Spinner as="span" size="sm" animation="border" /> : 'Enviar'}</Button>
              </Form>
              <div className="mt-3"><Link to="/login" className="small">Volver al acceso</Link></div>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
