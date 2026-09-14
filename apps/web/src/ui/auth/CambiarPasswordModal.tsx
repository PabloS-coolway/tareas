import { useState, type FormEvent } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { authGateway } from '../composition';

/**
 * MEJ · El propio usuario cambia su contraseña (tras entrar con la temporal que le dieron). Pide la actual y
 * la nueva por duplicado. La verificación real (que la actual sea correcta) la hace el servidor.
 */
export function CambiarPasswordModal({ onClose }: { onClose: () => void }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (nueva.length < 6) return setError('La nueva contraseña debe tener al menos 6 caracteres.');
    if (nueva !== repetir) return setError('La nueva contraseña y su repetición no coinciden.');
    setSaving(true);
    try {
      await authGateway.cambiarPassword(actual, nueva);
      setOk(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h6">Cambiar contraseña</Modal.Title>
      </Modal.Header>
      <Form onSubmit={enviar}>
        <Modal.Body>
          {ok ? (
            <Alert variant="success" className="mb-0">Contraseña actualizada. La próxima vez entra con la nueva.</Alert>
          ) : (
            <>
              {error && <Alert variant="danger" className="py-2">⚠ {error}</Alert>}
              <Form.Group className="mb-3">
                <Form.Label className="small">Contraseña actual</Form.Label>
                <Form.Control type="password" value={actual} required autoFocus onChange={(e) => setActual(e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="small">Nueva contraseña</Form.Label>
                <Form.Control type="password" value={nueva} required minLength={6} onChange={(e) => setNueva(e.target.value)} />
                <div className="text-secondary small mt-1">Mínimo 6 caracteres.</div>
              </Form.Group>
              <Form.Group>
                <Form.Label className="small">Repetir nueva contraseña</Form.Label>
                <Form.Control type="password" value={repetir} required onChange={(e) => setRepetir(e.target.value)} />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {ok ? (
            <Button className="btn-brand" onClick={onClose}>Hecho</Button>
          ) : (
            <>
              <Button variant="outline-secondary" onClick={onClose}>Cancelar</Button>
              <Button type="submit" className="btn-brand" disabled={saving}>
                {saving ? <Spinner as="span" size="sm" animation="border" /> : 'Cambiar'}
              </Button>
            </>
          )}
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
