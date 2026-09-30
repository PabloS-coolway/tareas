import { useEffect, useState, type ClipboardEvent, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { CheckCircleFill, ImageFill, KanbanFill, XCircleFill } from 'react-bootstrap-icons';
import type { PublicFormDto, PublicFormResultDto, PublicFormSubmitDto } from '@yorga/contracts';

const MEMORIA = 'tareas.formulario.';

const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Formulario público (sin cuenta) para abrir una incidencia con el enlace secreto: lo usan las
 * sucursales y los usuarios de las aplicaciones (el SaaS). Los textos dependen del tipo del proyecto.
 * Se pueden adjuntar capturas, también pegándolas con Ctrl+V.
 */
export function FormularioPublicoPage() {
  const { token = '' } = useParams();
  const [form, setForm] = useState<PublicFormDto | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);
  const [imagenes, setImagenes] = useState<File[]>([]);
  const [avisoImagen, setAvisoImagen] = useState('');
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

  /** Añade imágenes (del selector o pegadas), con las mismas reglas que la API para avisar antes de enviar. */
  function anadir(ficheros: File[]) {
    if (!form) return;
    setAvisoImagen('');
    const validas = ficheros.filter((f) => TIPOS_IMAGEN.includes(f.type));
    if (validas.length < ficheros.length) setAvisoImagen('Solo imágenes: PNG, JPG, WebP o GIF.');
    const grandes = validas.filter((f) => f.size > form.imagenes.maxMb * 1024 * 1024);
    if (grandes.length) setAvisoImagen(`«${grandes[0].name}» pesa más de ${form.imagenes.maxMb} MB.`);
    const nuevas = [...imagenes, ...validas.filter((f) => !grandes.includes(f))];
    if (nuevas.length > form.imagenes.max) setAvisoImagen(`Como mucho ${form.imagenes.max} imágenes.`);
    setImagenes(nuevas.slice(0, form.imagenes.max));
  }

  function alPegar(e: ClipboardEvent) {
    if (!form?.imagenes.admite) return;
    const pegadas = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
    if (!pegadas.length) return;
    e.preventDefault();
    // Una captura pegada llega como «image.png»: se le pone un nombre que diga algo.
    anadir(pegadas.map((f, i) => new File([f], `captura-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}${i ? `-${i}` : ''}.png`, { type: f.type })));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      // Multipart siempre: los campos y, si hay, las imágenes en `imagenes`.
      const datos = new FormData();
      Object.entries(f).forEach(([k, v]) => datos.append(k, String(v ?? '')));
      imagenes.forEach((img) => datos.append('imagenes', img, img.name));
      const r = await fetch(`/api/public/forms/${encodeURIComponent(token)}`, { method: 'POST', body: datos });
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
              <Button variant="outline-secondary" onClick={() => { setHecho(null); setImagenes([]); setF({ ...f, asunto: '', descripcion: '', urgencia: 'NORMAL' }); }}>Enviar otra</Button>
            </div>
          ) : (
            <>
              <h1 className="h4 mb-1">Abrir una incidencia</h1>
              <p className="text-secondary mb-4">Cuéntanos qué pasa y te respondemos lo antes posible.</p>
              {error && <Alert variant="danger">{error}</Alert>}
              {!form && !error ? (
                <div className="text-center py-4"><Spinner animation="border" /></div>
              ) : form ? (
                <Form onSubmit={(e) => void enviar(e)} onPaste={alPegar}>
                  <Form.Group className="mb-3" controlId="fp-sucursal">
                    <Form.Label>{form.label}</Form.Label>
                    {form.sucursales.length ? (
                      <Form.Select value={f.sucursal} onChange={(e) => setF({ ...f, sucursal: e.target.value })} required>
                        <option value="">Elige…</option>
                        {form.sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
                      </Form.Select>
                    ) : (
                      <Form.Control value={f.sucursal} onChange={(e) => setF({ ...f, sucursal: e.target.value })} placeholder={form.kind === 'sucursal' ? 'Número o nombre de la sucursal' : ''} required />
                    )}
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="fp-nombre">
                    <Form.Label>Tu nombre</Form.Label>
                    <Form.Control value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoComplete="name" required />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="fp-asunto">
                    <Form.Label>¿Qué pasa?</Form.Label>
                    <Form.Control value={f.asunto} onChange={(e) => setF({ ...f, asunto: e.target.value })} placeholder={form.textos.ejemploAsunto} maxLength={140} required />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="fp-desc">
                    <Form.Label>Más detalle <span className="text-secondary">(opcional)</span></Form.Label>
                    <Form.Control as="textarea" rows={4} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder={form.textos.ejemploDetalle} />
                  </Form.Group>
                  {form.imagenes.admite && (
                    <Form.Group className="mb-3" controlId="fp-imagenes">
                      <Form.Label>Capturas o fotos <span className="text-secondary">(opcional, hasta {form.imagenes.max})</span></Form.Label>
                      <Form.Control
                        type="file"
                        accept={TIPOS_IMAGEN.join(',')}
                        multiple
                        disabled={imagenes.length >= form.imagenes.max}
                        onChange={(e) => {
                          anadir(Array.from((e.target as HTMLInputElement).files ?? []));
                          (e.target as HTMLInputElement).value = '';
                        }}
                      />
                      <Form.Text>También puedes pegar una captura con Ctrl+V en cualquier parte del formulario.</Form.Text>
                      {avisoImagen && <div className="text-danger small mt-1">{avisoImagen}</div>}
                      {imagenes.length > 0 && (
                        <div className="d-flex flex-wrap gap-2 mt-2">
                          {imagenes.map((img, i) => (
                            <div key={`${img.name}-${i}`} className="position-relative border rounded p-1 text-center" style={{ width: 96 }}>
                              <img src={URL.createObjectURL(img)} alt={img.name} style={{ width: 86, height: 64, objectFit: 'cover' }} className="rounded" />
                              <div className="small text-truncate" title={img.name}><ImageFill className="me-1" />{img.name}</div>
                              <button type="button" className="btn btn-link p-0 position-absolute top-0 end-0 text-danger" aria-label={`Quitar ${img.name}`} onClick={() => setImagenes(imagenes.filter((_, j) => j !== i))}>
                                <XCircleFill />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Form.Group>
                  )}
                  <Form.Group className="mb-4">
                    <Form.Label>Urgencia</Form.Label>
                    <div className="d-flex flex-wrap gap-3">
                      {(['NORMAL', 'HIGH', 'URGENT'] as const).map((v) => [v, form.textos.urgencias[v]] as const).map(([v, l]) => (
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
