import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, InputGroup } from 'react-bootstrap';
import { ArrowRepeat, Clipboard, Stopwatch } from 'react-bootstrap-icons';
import { PRIORITIES, PRIORITY_LABELS, type IntakeConfigDto, type SlaHoursDto, type UserRefDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { useProyectos } from '../proyectos/ProyectosContext';

const POR_DEFECTO: SlaHoursDto = { URGENT: 2, HIGH: 8, NORMAL: 24, LOW: 72 };

/** Formulario público de alta y plazos de respuesta, por proyecto. */
export function FormulariosPage() {
  const { proyectos } = useProyectos();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [cfg, setCfg] = useState<IntakeConfigDto | null>(null);
  const [sucursales, setSucursales] = useState('');
  const [equipo, setEquipo] = useState<UserRefDto[]>([]);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    tareasGateway.directorio().then(setEquipo).catch(() => setEquipo([]));
  }, []);
  useEffect(() => {
    if (projectId === null && proyectos.length) setProjectId((proyectos.find((p) => p.key === 'INC') ?? proyectos[0]).id);
  }, [proyectos, projectId]);
  useEffect(() => {
    if (projectId === null) return;
    setCfg(null);
    tareasGateway.formulario(projectId).then((c) => { setCfg(c); setSucursales(c.sucursales.join('\n')); }).catch((e) => setError((e as Error).message));
  }, [projectId]);

  async function guardar(cambio: Parameters<typeof tareasGateway.guardarFormulario>[1], ok = 'Guardado.') {
    if (projectId === null) return;
    try {
      const c = await tareasGateway.guardarFormulario(projectId, cambio);
      setCfg(c);
      setSucursales(c.sucursales.join('\n'));
      setAviso(ok);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const enlace = cfg?.token ? `${location.origin}/f/${cfg.token}` : '';
  const sla = cfg?.sla ?? {};

  return (
    <div className="page">
      <header className="page-head mb-4">
        <h1 className="h4 mb-1">Formularios y plazos</h1>
        <p className="text-secondary mb-0">Un enlace para que las sucursales abran incidencias sin cuenta, y el tiempo máximo hasta que alguien las empiece.</p>
      </header>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}
      {aviso && <Alert variant="success" dismissible onClose={() => setAviso('')} className="py-2">{aviso}</Alert>}

      <Form.Select className="mb-3" style={{ maxWidth: 320 }} value={projectId ?? ''} onChange={(e) => setProjectId(Number(e.target.value))} aria-label="Proyecto">
        {proyectos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Form.Select>

      {cfg && (
        <>
          <Card className="mb-3">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                <h2 className="h6 mb-0">Formulario público {cfg.active ? <Badge bg="success">activo</Badge> : <Badge bg="secondary">apagado</Badge>}</h2>
                <Form.Check type="switch" id="fm-active" label={cfg.active ? 'Activo' : 'Activar'} checked={cfg.active} onChange={(e) => void guardar({ active: e.target.checked }, e.target.checked ? 'Formulario activado: las tareas que entren constan como creadas por ti.' : 'Formulario apagado: el enlace deja de funcionar.')} />
              </div>
              <p className="small text-secondary">Lo que entra por él se crea como <b>incidencia</b> en este proyecto, con la sucursal en el título y la etiqueta «formulario». Las reglas automáticas del proyecto se aplican igual.</p>
              {cfg.token && (
                <InputGroup size="sm" className="mb-3">
                  <Form.Control readOnly value={enlace} aria-label="Enlace del formulario" disabled={!cfg.active} />
                  <Button variant="outline-secondary" onClick={() => void navigator.clipboard.writeText(enlace).then(() => setAviso('Enlace copiado.'))} title="Copiar"><Clipboard /></Button>
                  <Button variant="outline-secondary" onClick={() => confirm('¿Generar un enlace nuevo? El actual dejará de funcionar.') && void guardar({ regenerate: true }, 'Enlace nuevo generado: pásalo a las sucursales.')} title="Enlace nuevo (si el actual se ha filtrado)"><ArrowRepeat /></Button>
                </InputGroup>
              )}
              <Form.Group controlId="fm-sucursales">
                <Form.Label className="small fw-semibold">Sucursales (una por línea)</Form.Label>
                <Form.Control as="textarea" rows={6} value={sucursales} onChange={(e) => setSucursales(e.target.value)} placeholder={'Sucursal 9\nSucursal 12 · Palermo\n…'} />
                <Form.Text>Si la dejas vacía, la sucursal se escribe a mano.</Form.Text>
              </Form.Group>
              <Button size="sm" className="btn-brand mt-2" onClick={() => void guardar({ sucursales: sucursales.split('\n') })}>Guardar sucursales</Button>
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                <h2 className="h6 mb-0"><Stopwatch className="me-1" /> Plazo de respuesta {cfg.sla ? <Badge bg="success">activo</Badge> : <Badge bg="secondary">sin plazos</Badge>}</h2>
                {cfg.sla ? (
                  <Button size="sm" variant="link" className="text-danger p-0" onClick={() => void guardar({ sla: null }, 'Plazos quitados.')}>Quitar plazos</Button>
                ) : (
                  <Button size="sm" variant="outline-secondary" onClick={() => void guardar({ sla: POR_DEFECTO }, 'Plazos activados con los valores por defecto.')}>Activar (2 h / 8 h / 24 h / 72 h)</Button>
                )}
              </div>
              <p className="small text-secondary">Horas desde que se crea hasta que alguien la pasa a «en marcha». Pasado el plazo, la tarjeta se marca <span className="pill sla">⏱ fuera de plazo</span> y se avisa (una vez) al responsable, a quien la creó, a sus seguidores y a las personas de abajo.</p>
              {cfg.sla && (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-3">
                    {PRIORITIES.map((p) => (
                      <Form.Group key={p} controlId={`fm-sla-${p}`} style={{ width: 130 }}>
                        <Form.Label className="small mb-1">{PRIORITY_LABELS[p]}</Form.Label>
                        <InputGroup size="sm">
                          <Form.Control type="number" min={0} step={0.5} defaultValue={sla[p] ?? ''} onBlur={(e) => void guardar({ sla: { ...sla, [p]: Number(e.target.value) || undefined } })} />
                          <InputGroup.Text>h</InputGroup.Text>
                        </InputGroup>
                      </Form.Group>
                    ))}
                  </div>
                  <Form.Label className="small fw-semibold" htmlFor="fm-notify">Avisar además a</Form.Label>
                  <div className="d-flex flex-wrap gap-1 align-items-center">
                    {cfg.slaNotifyUserIds.map((u) => (
                      <Badge key={u} bg="light" text="dark" className="border">
                        {equipo.find((x) => x.id === u)?.name ?? u}{' '}
                        <button type="button" className="btn btn-link btn-sm p-0 text-secondary" onClick={() => void guardar({ slaNotifyUserIds: cfg.slaNotifyUserIds.filter((x) => x !== u) })} aria-label="Quitar">×</button>
                      </Badge>
                    ))}
                    <Form.Select id="fm-notify" size="sm" value="" style={{ maxWidth: 220 }} onChange={(e) => e.target.value && void guardar({ slaNotifyUserIds: [...cfg.slaNotifyUserIds, Number(e.target.value)] })}>
                      <option value="">Añadir…</option>
                      {equipo.filter((u) => !cfg.slaNotifyUserIds.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </Form.Select>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
}
