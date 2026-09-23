import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { CheckCircleFill, KanbanFill } from 'react-bootstrap-icons';
import type { PublicFormDto, PublicFormResultDto, PublicFormSubmitDto } from '@yorga/contracts';

const MEMORIA = 'tareas.formulario.';

/** Formulario público (sin cuenta) para abrir una incidencia: lo usan las sucursales con el enlace secreto. */
export function FormularioPublicoPage() {
  const { token = '' } = useParams();
  const [form, setForm] = useState<PublicFormDto | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);
  // Sucursal y nombre se recuerdan en este navegador: la próxima vez ya vienen puestos.
  const recordado = (() => {
    try {
      return JSON.parse(localStorage.getItem(MEMORIA + token) ?? '{}') as { sucursal?: string; nombre?: string };
    } catch {
      return {};
    }
  })();
  const [f, setF] = useState<PublicFormSubmitDto>({ sucursal: recordado.sucursal ?? '', nombre: recordado.nombre ?? '', asunto: '', descripcion: '', urgencia: 'NORMAL', web: '' });

  useEffect(() => {
    fetch(`/api/public/forms/${encodeURIComponent(token)}`)
      .then(async (r) => (r.ok ? setForm(await r.json()) : setError('Este formulario no existe o está desactivado. Pide el enlace nuevo a sistemas.')))
      .catch(() => setError('No hay conexión. Prueba de nuevo en un momento.'));
  }, [token]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const r = await fetch(`/api/public/forms/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((body as { message?: string }).message ?? 'No se pudo enviar.');
      try {
        localStorage.setItem(MEMORIA + token, JSON.stringify({ sucursal: f.sucursal, nombre: f.nombre }));
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
      setHecho((body as PublicFormResultDto).key);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="form-publico">
      <Card>
        <Card.Body className="p-4">
          <div className="d-flex align-items-center gap-2 mb-3 text-secondary small"><KanbanFill /> Grupo Yorga · {form?.projectName ?? 'Incidencias'}</div>
          {hecho ? (
            <div className="text-center py-4">
              <CheckCircleFill className="text-success mb-3" size={48} />
              <h1 className="h4">Recibido</h1>
              <p className="mb-1">Tu incidencia es la <b className="task-key fs-5">{hecho}</b>.</p>
              <p className="text-secondary">Guárdate el número por si tienes que preguntar por ella.</p>
              <Button variant="outline-secondary" onClick={() => { setHecho(null); setF({ ...f, asunto: '', descripcion: '', urgencia: 'NORMAL' }); }}>Enviar otra</Button>
            </div>
          ) : (
            <>
              <h1 className="h4 mb-1">Abrir una incidencia</h1>
              <p className="text-secondary mb-4">Cuéntanos qué pasa y te respondemos lo antes posible.</p>
              {error && <Alert variant="danger">{error}</Alert>}
              {!form && !error ? (
                <div className="text-center py-4"><Spinner animation="border" /></div>
              ) : form ? (
                <Form onSubmit={(e) => void enviar(e)}>
                  <Form.Group className="mb-3" controlId="fp-sucursal">
                    <Form.Label>Sucursal</Form.Label>
                    {form.sucursales.length ? (
                      <Form.Select value={f.sucursal} onChange={(e) => setF({ ...f, sucursal: e.target.value })} required>
                        <option value="">Elige tu sucursal…</option>
                        {form.sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
                      </Form.Select>
                    ) : (
                      <Form.Control value={f.sucursal} onChange={(e) => setF({ ...f, sucursal: e.target.value })} placeholder="Número o nombre de la sucursal" required />
                    )}
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="fp-nombre">
                    <Form.Label>Tu nombre</Form.Label>
                    <Form.Control value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoComplete="name" required />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="fp-asunto">
                    <Form.Label>¿Qué pasa?</Form.Label>
                    <Form.Control value={f.asunto} onChange={(e) => setF({ ...f, asunto: e.target.value })} placeholder="p. ej. No funciona el datáfono" maxLength={140} required />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="fp-desc">
                    <Form.Label>Más detalle <span className="text-secondary">(opcional)</span></Form.Label>
                    <Form.Control as="textarea" rows={4} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Desde cuándo, qué has probado, número de ticket…" />
                  </Form.Group>
                  <Form.Group className="mb-4">
                    <Form.Label>Urgencia</Form.Label>
                    <div className="d-flex flex-wrap gap-3">
                      {([['NORMAL', 'Normal'], ['HIGH', 'Alta: afecta a la venta'], ['URGENT', 'Urgente: no podemos vender']] as const).map(([v, l]) => (
                        <Form.Check key={v} type="radio" id={`fp-u-${v}`} name="urgencia" label={l} checked={f.urgencia === v} onChange={() => setF({ ...f, urgencia: v })} />
                      ))}
                    </div>
                  </Form.Group>
                  <div className="trampa" aria-hidden="true">
                    <label htmlFor="fp-web">No rellenar</label>
                    <input id="fp-web" tabIndex={-1} autoComplete="off" value={f.web} onChange={(e) => setF({ ...f, web: e.target.value })} />
                  </div>
                  <Button type="submit" className="btn-brand w-100" disabled={enviando}>{enviando ? <Spinner size="sm" animation="border" /> : 'Enviar incidencia'}</Button>
                </Form>
              ) : null}
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
