import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';

/**
 * Preferencias de correo de una persona. Componente autocontenido (sin gateways ni contextos de la app) para
 * llevarlo tal cual a otra app: recibe el catálogo de tipos, los ámbitos, la escala de niveles y el horario del
 * resumen, y devuelve lo elegido en `onGuardar`.
 */

export interface ValorPreferencias {
  activo: boolean;
  tipos: string[];
  ambitos: { modo: 'todos' | 'solo' | 'silenciar'; ids: number[] };
  nivelMinimo: number | null;
  modo: 'inmediato' | 'resumen';
}

interface Props {
  valor: ValorPreferencias;
  catalogo: { clave: string; etiqueta: string }[];
  /** Lo que se puede filtrar (en Tareas, los proyectos que ves). */
  ambitos: { id: number; nombre: string }[];
  /** Cómo se llaman los ámbitos en esta app, en plural y minúscula («proyectos»). */
  nombreAmbitos: string;
  niveles: { valor: number; etiqueta: string }[];
  /** Cómo se llaman los niveles («prioridad»). */
  nombreNivel: string;
  horarioResumen: string;
  onGuardar: (v: ValorPreferencias) => Promise<void>;
}

export function PreferenciasCorreo({ valor, catalogo, ambitos, nombreAmbitos, niveles, nombreNivel, horarioResumen, onGuardar }: Props) {
  const [v, setV] = useState(valor);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  useEffect(() => setV(valor), [valor]);

  const cambiar = (parcial: Partial<ValorPreferencias>) => {
    setOk(false);
    setV((x) => ({ ...x, ...parcial }));
  };
  const alternar = <T,>(lista: T[], x: T) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x]);

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      await onGuardar(v);
      setOk(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pref-correo">
      <Form.Check
        type="switch"
        id="pc-activo"
        className="mb-3 fw-semibold"
        label="Recibir avisos por correo"
        checked={v.activo}
        onChange={(e) => cambiar({ activo: e.target.checked })}
      />
      <fieldset disabled={!v.activo} className={v.activo ? '' : 'opacity-50'}>
        <h3 className="h6 mt-2">Qué avisos</h3>
        {catalogo.map((t) => (
          <Form.Check key={t.clave} type="checkbox" id={`pc-t-${t.clave}`} label={t.etiqueta} checked={v.tipos.includes(t.clave)} onChange={() => cambiar({ tipos: alternar(v.tipos, t.clave) })} />
        ))}

        <h3 className="h6 mt-4">De qué {nombreAmbitos}</h3>
        {(['todos', 'solo', 'silenciar'] as const).map((m) => (
          <Form.Check
            key={m}
            type="radio"
            name="pc-ambitos"
            id={`pc-a-${m}`}
            label={m === 'todos' ? `De todos los ${nombreAmbitos}` : m === 'solo' ? `Solo de estos ${nombreAmbitos}` : `De todos menos estos (silenciados)`}
            checked={v.ambitos.modo === m}
            onChange={() => cambiar({ ambitos: { modo: m, ids: m === 'todos' ? [] : v.ambitos.ids } })}
          />
        ))}
        {v.ambitos.modo !== 'todos' && (
          <div className="pref-correo-ambitos mt-2">
            {ambitos.map((a) => (
              <Form.Check key={a.id} inline type="checkbox" id={`pc-am-${a.id}`} label={a.nombre} checked={v.ambitos.ids.includes(a.id)} onChange={() => cambiar({ ambitos: { ...v.ambitos, ids: alternar(v.ambitos.ids, a.id) } })} />
            ))}
            {v.ambitos.modo === 'solo' && <Form.Text className="d-block">Si se crean {nombreAmbitos} nuevos, no te llegarán correos de ellos hasta que los añadas aquí.</Form.Text>}
          </div>
        )}

        <h3 className="h6 mt-4">{nombreNivel.charAt(0).toUpperCase() + nombreNivel.slice(1)} mínima</h3>
        <Form.Select style={{ maxWidth: 280 }} value={v.nivelMinimo ?? ''} onChange={(e) => cambiar({ nivelMinimo: e.target.value === '' ? null : Number(e.target.value) })} aria-label={`${nombreNivel} mínima`}>
          <option value="">Cualquier {nombreNivel}</option>
          {niveles.slice(1).map((n) => (
            <option key={n.valor} value={n.valor}>{n.etiqueta} o más</option>
          ))}
        </Form.Select>

        <h3 className="h6 mt-4">Cuándo</h3>
        <Form.Check type="radio" name="pc-modo" id="pc-m-inmediato" label="Al momento, un correo por aviso" checked={v.modo === 'inmediato'} onChange={() => cambiar({ modo: 'inmediato' })} />
        <Form.Check type="radio" name="pc-modo" id="pc-m-resumen" label={`Un resumen ${horarioResumen}, con lo que siga sin leer`} checked={v.modo === 'resumen'} onChange={() => cambiar({ modo: 'resumen' })} />
      </fieldset>

      {error && <Alert variant="danger" className="mt-3 mb-0">⚠ {error}</Alert>}
      <div className="d-flex align-items-center gap-3 mt-4">
        <Button className="btn-brand" onClick={() => void guardar()} disabled={guardando}>
          {guardando && <Spinner as="span" size="sm" animation="border" className="me-2" />}Guardar
        </Button>
        {ok && <span className="text-success small">✓ Guardado</span>}
      </div>
    </div>
  );
}
