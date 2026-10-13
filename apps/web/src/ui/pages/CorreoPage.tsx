import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import type { CorreoConfigDto, CorreoRegistroDto, ProveedorCorreo } from '@yorga/contracts';
import { correoGateway } from '../composition';
import { useAuth } from '../auth/AuthContext';
import { fmtFechaHora, hace } from '../components/tareas-ui';
import { Skeleton } from '../components/Skeleton';

const AYUDA: Record<ProveedorCorreo, { etiqueta: string; placeholder: string; ayuda: string }> = {
  brevo: {
    etiqueta: 'Clave de API de Brevo',
    placeholder: 'xkeysib-…',
    ayuda: 'En Brevo: Ajustes → SMTP y API → Claves de API. El plan gratuito permite 300 correos al día. El dominio del remitente tiene que estar verificado en Brevo.',
  },
  smtp: {
    etiqueta: 'URL del servidor SMTP',
    placeholder: 'smtps://usuario:contraseña@smtp.ejemplo.com:465',
    ayuda: 'Un buzón del propio dominio (Google Workspace, Office 365…) o el SMTP de un proveedor. Si la contraseña lleva símbolos, escríbelos codificados (p. ej. @ → %40).',
  },
};

const TIPOS: Record<string, string> = {
  'aviso.asignada': 'Asignación',
  'aviso.mencion': 'Mención',
  'aviso.plazo': 'Plazo vencido',
  contrasena: 'Contraseña',
};

const ORIGEN: Record<CorreoConfigDto['origen'], { texto: string; bg: string }> = {
  panel: { texto: 'Configurado', bg: 'success' },
  entorno: { texto: 'SMTP del servidor (variables de entorno)', bg: 'warning' },
  ninguno: { texto: 'Sin configurar', bg: 'secondary' },
};

interface Formulario {
  proveedor: ProveedorCorreo;
  credencial: string;
  remitenteNombre: string;
  remitenteEmail: string;
  responderA: string;
  marcaNombre: string;
  url: string;
  pie: string;
  prefijo: string;
  avisosActivos: boolean;
}

function desdeConfig(c: CorreoConfigDto): Formulario {
  return {
    proveedor: c.proveedor ?? 'brevo',
    credencial: '',
    remitenteNombre: c.remitente?.nombre ?? c.sugerencia.remitenteNombre,
    remitenteEmail: c.remitente?.email ?? '',
    responderA: c.responderA ?? '',
    marcaNombre: c.marca?.nombre ?? c.sugerencia.marcaNombre,
    url: c.marca?.url ?? c.sugerencia.url,
    pie: c.marca?.pie ?? '',
    prefijo: c.marca?.prefijoAsunto ?? '',
    avisosActivos: c.avisosActivos,
  };
}

/** Correo saliente: proveedor, remitente, marca, interruptor de avisos, correo de prueba y registro de envíos. */
export function CorreoPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<CorreoConfigDto | null>(null);
  const [f, setF] = useState<Formulario | null>(null);
  const [registro, setRegistro] = useState<CorreoRegistroDto[] | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [para, setPara] = useState(user?.email ?? '');
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<{ ok: boolean; texto: string } | null>(null);

  const cargarRegistro = useCallback(() => correoGateway.registro().then(setRegistro).catch(() => undefined), []);

  useEffect(() => {
    correoGateway
      .leer()
      .then((c) => {
        setConfig(c);
        setF(desdeConfig(c));
      })
      .catch((e) => setError((e as Error).message));
    void cargarRegistro();
    const t = setInterval(() => void cargarRegistro(), 30_000);
    return () => clearInterval(t);
  }, [cargarRegistro]);

  const cambiar = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => (x ? { ...x, [k]: v } : x));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!f) return;
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      const c = await correoGateway.guardar({
        proveedor: f.proveedor,
        credencial: f.credencial.trim() || null,
        remitente: { nombre: f.remitenteNombre, email: f.remitenteEmail },
        responderA: f.responderA || null,
        marca: { nombre: f.marcaNombre, url: f.url, pie: f.pie, prefijoAsunto: f.prefijo },
        avisosActivos: f.avisosActivos,
      });
      setConfig(c);
      setF(desdeConfig(c));
      setAviso('Configuración guardada.');
      void cargarRegistro();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function probar() {
    setProbando(true);
    setPrueba(null);
    try {
      const r = await correoGateway.probar(para);
      setPrueba(r.ok ? { ok: true, texto: `Enviado a ${para}. Revisa la bandeja de entrada (y la de spam).` } : { ok: false, texto: r.error ?? 'No se pudo enviar.' });
    } catch (err) {
      setPrueba({ ok: false, texto: (err as Error).message });
    } finally {
      setProbando(false);
    }
  }

  if (!config || !f) {
    return (
      <div className="page page-wide">
        {error ? <Alert variant="danger">⚠ {error}</Alert> : <Skeleton className="skeleton-rounded" width="100%" height={240} />}
      </div>
    );
  }

  const ayuda = AYUDA[f.proveedor];
  const conservaCredencial = config.credencial && config.proveedor === f.proveedor;
  const origen = ORIGEN[config.origen];

  return (
    <div className="page page-wide">
      <header className="page-head mb-4">
        <h1 className="h4 mb-1 d-flex align-items-center gap-2">
          Correo <Badge bg={`${origen.bg}-subtle`} text={origen.bg === 'secondary' ? 'secondary' : origen.bg} className="fs-6 fw-normal">{origen.texto}</Badge>
        </h1>
        <p className="text-secondary mb-0">Con qué proveedor envía correos la app: avisos importantes (si los enciendes) y el enlace de «He olvidado mi contraseña».</p>
      </header>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}
      {aviso && <Alert variant="success" dismissible onClose={() => setAviso('')}>{aviso}</Alert>}
      {!config.claveMaestraDisponible && (
        <Alert variant="warning">
          El servidor no tiene configurada la clave maestra de cifrado (<code>MAIL_ENCRYPTION_KEY</code>), así que no se puede guardar la clave del proveedor. Hay que crearla en las variables de entorno del servidor y volver a desplegar.
        </Alert>
      )}

      <Form onSubmit={guardar}>
        <Card className="mb-4">
          <Card.Body>
            <Card.Title className="mb-3">Proveedor</Card.Title>
            <Row className="g-3">
              <Col md={4}>
                <Form.Label htmlFor="c-prov">Proveedor</Form.Label>
                <Form.Select id="c-prov" value={f.proveedor} onChange={(e) => cambiar('proveedor', e.target.value as ProveedorCorreo)}>
                  <option value="brevo">Brevo (API)</option>
                  <option value="smtp">SMTP</option>
                </Form.Select>
              </Col>
              <Col md={8}>
                <Form.Label htmlFor="c-cred">{ayuda.etiqueta}</Form.Label>
                <Form.Control
                  id="c-cred"
                  type="password"
                  autoComplete="new-password"
                  value={f.credencial}
                  onChange={(e) => cambiar('credencial', e.target.value)}
                  placeholder={conservaCredencial ? `${config.credencial} · déjala vacía para no cambiarla` : ayuda.placeholder}
                />
                <Form.Text>{ayuda.ayuda}</Form.Text>
              </Col>
              <Col md={4}>
                <Form.Label htmlFor="c-rn">Nombre del remitente</Form.Label>
                <Form.Control id="c-rn" value={f.remitenteNombre} onChange={(e) => cambiar('remitenteNombre', e.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label htmlFor="c-re">Dirección del remitente</Form.Label>
                <Form.Control id="c-re" type="email" value={f.remitenteEmail} onChange={(e) => cambiar('remitenteEmail', e.target.value)} placeholder="tareas@tudominio.com" />
              </Col>
              <Col md={4}>
                <Form.Label htmlFor="c-rt">Responder a <span className="text-secondary">(opcional)</span></Form.Label>
                <Form.Control id="c-rt" type="email" value={f.responderA} onChange={(e) => cambiar('responderA', e.target.value)} />
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Card className="mb-4">
          <Card.Body>
            <Card.Title className="mb-3">Cómo se ven los correos</Card.Title>
            <Row className="g-3">
              <Col md={4}>
                <Form.Label htmlFor="c-mn">Nombre de la app</Form.Label>
                <Form.Control id="c-mn" value={f.marcaNombre} onChange={(e) => cambiar('marcaNombre', e.target.value)} />
              </Col>
              <Col md={8}>
                <Form.Label htmlFor="c-url">URL pública</Form.Label>
                <Form.Control id="c-url" value={f.url} onChange={(e) => cambiar('url', e.target.value)} />
                <Form.Text>Los botones de los correos abren esta dirección (p. ej. …/t/COOL-12).</Form.Text>
              </Col>
              <Col md={8}>
                <Form.Label htmlFor="c-pie">Pie <span className="text-secondary">(opcional)</span></Form.Label>
                <Form.Control id="c-pie" value={f.pie} onChange={(e) => cambiar('pie', e.target.value)} placeholder="Grupo Yorga · Tareas" />
              </Col>
              <Col md={4}>
                <Form.Label htmlFor="c-pre">Etiqueta del asunto <span className="text-secondary">(opcional)</span></Form.Label>
                <Form.Control id="c-pre" value={f.prefijo} maxLength={30} onChange={(e) => cambiar('prefijo', e.target.value)} placeholder="[Tareas]" />
                <Form.Text>Va delante del asunto de todos los correos, para filtrarlos con una regla de tu buzón.</Form.Text>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Card className="mb-4">
          <Card.Body>
            <Card.Title className="mb-2">Avisos por correo</Card.Title>
            <Form.Check
              type="switch"
              id="c-avisos"
              checked={f.avisosActivos}
              onChange={(e) => cambiar('avisosActivos', e.target.checked)}
              label="Enviar avisos por correo: te asignan una tarea, te mencionan o vence el plazo de respuesta de una incidencia"
            />
            <Form.Text>
              Solo se envían los avisos que lleguen desde que lo enciendes (no los antiguos). Al apagarlo se cortan al momento.
              {config.avisosActivos && config.avisosDesde && <> Encendido desde el {fmtFechaHora(config.avisosDesde)}.</>}
            </Form.Text>
          </Card.Body>
        </Card>

        <div className="d-flex align-items-center gap-3 mb-4">
          <Button type="submit" className="btn-brand" disabled={guardando}>
            {guardando && <Spinner as="span" size="sm" animation="border" className="me-2" />}Guardar
          </Button>
          {config.actualizadoEn && <span className="small text-secondary">Última modificación {hace(config.actualizadoEn)}{config.actualizadoPor ? ` por ${config.actualizadoPor}` : ''}.</span>}
        </div>
      </Form>

      <Card className="mb-4">
        <Card.Body>
          <Card.Title className="mb-2">Correo de prueba</Card.Title>
          <p className="small text-secondary">Se envía con la configuración guardada (guarda antes si has cambiado algo).</p>
          <div className="d-flex gap-2 flex-wrap">
            <Form.Control type="email" value={para} onChange={(e) => setPara(e.target.value)} style={{ maxWidth: 320 }} aria-label="Enviar la prueba a" />
            <Button variant="outline-secondary" onClick={() => void probar()} disabled={probando || !para}>
              {probando && <Spinner as="span" size="sm" animation="border" className="me-2" />}Enviar correo de prueba
            </Button>
          </div>
          {prueba && <Alert variant={prueba.ok ? 'success' : 'danger'} className="mt-3 mb-0">{prueba.ok ? '✓' : '⚠'} {prueba.texto}</Alert>}
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Card.Title className="mb-0">Registro de envíos <span className="text-secondary fw-normal small">últimos 100 · se guardan 90 días</span></Card.Title>
            <Button size="sm" variant="link" onClick={() => void cargarRegistro()}>Actualizar</Button>
          </div>
          <div className="kpi-table-wrap">
            <table className="table table-sm mb-0 tabular kpi-table">
              <thead><tr><th>Fecha</th><th>Para</th><th>Asunto</th><th>Tipo</th><th>Estado</th><th className="text-end">Intentos</th><th>Detalle</th></tr></thead>
              <tbody>
                {(registro ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="text-nowrap">{fmtFechaHora(r.creadoEn)}</td>
                    <td>{r.para}</td>
                    <td className="text-truncate" style={{ maxWidth: 280 }} title={r.asunto}>{r.asunto}</td>
                    <td className="text-nowrap">{TIPOS[r.tipo] ?? r.tipo}</td>
                    <td>
                      {r.estado === 'enviado' ? <Badge bg="success-subtle" text="success">enviado</Badge> : r.estado === 'fallido' ? <Badge bg="danger-subtle" text="danger">fallido</Badge> : <Badge bg="warning-subtle" text="warning">pendiente</Badge>}
                    </td>
                    <td className="text-end">{r.intentos}</td>
                    <td className="small">
                      {r.error && <span className="text-danger">{r.error}</span>}
                      {r.estado === 'pendiente' && r.proximoIntento && <span className="text-secondary">{r.error ? ' · ' : ''}próximo intento: {fmtFechaHora(r.proximoIntento)}</span>}
                    </td>
                  </tr>
                ))}
                {registro?.length === 0 && <tr><td colSpan={7} className="text-secondary">Todavía no se ha enviado ningún correo.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
