import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner } from 'react-bootstrap';
import type { AdminTokenDto, TokenLogDto } from '@yorga/contracts';
import { tokensGateway } from '../composition';
import { Avatar, fmtFechaHora, hace } from '../components/tareas-ui';
import { Skeleton } from '../components/Skeleton';

const TRAMO = 100;

/** Integraciones (MCP y API): quién está conectado, tokens de todo el equipo y registro de llamadas. */
export function IntegracionesPage() {
  const [tokens, setTokens] = useState<AdminTokenDto[] | null>(null);
  const [logs, setLogs] = useState<TokenLogDto[] | null>(null);
  const [userId, setUserId] = useState('');
  const [verRevocados, setVerRevocados] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hayMas, setHayMas] = useState(true);

  const load = useCallback(async () => {
    try {
      const [t, l] = await Promise.all([tokensGateway.listAll(), tokensGateway.logs({ userId: userId ? Number(userId) : undefined, limit: TRAMO })]);
      setTokens(t);
      setLogs(l);
      setHayMas(l.length === TRAMO);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000); // «conectado ahora» se refresca solo
    return () => clearInterval(t);
  }, [load]);

  async function cargarMas() {
    if (!logs?.length) return;
    const l = await tokensGateway.logs({ userId: userId ? Number(userId) : undefined, limit: TRAMO, before: logs[logs.length - 1].id }).catch(() => []);
    setLogs([...logs, ...l]);
    setHayMas(l.length === TRAMO);
  }

  async function revocar(t: AdminTokenDto) {
    if (!window.confirm(`¿Revocar el token «${t.name}» de ${t.user.name}? Dejará de funcionar al instante.`)) return;
    setBusy(true);
    try {
      await tokensGateway.revokeAny(t.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const usuarios = [...new Map((tokens ?? []).map((t) => [t.user.id, t.user])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const visibles = (tokens ?? []).filter((t) => verRevocados || !t.revokedAt);
  const conectados = (tokens ?? []).filter((t) => t.connected && !t.revokedAt);

  return (
    <div className="page page-wide">
      <header className="page-head mb-4">
        <h1 className="h4 mb-1">Integraciones {busy && <Spinner as="span" size="sm" animation="border" />}</h1>
        <p className="text-secondary mb-0">Quién usa la API y el MCP con su token personal, y qué hace. Revocar un token lo corta al momento; la persona puede crear otro en «Tokens de API».</p>
      </header>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}

      {!tokens ? (
        <Skeleton className="skeleton-rounded" width="100%" height={160} />
      ) : (
        <>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title className="mb-2">Conectados ahora <span className="text-secondary fw-normal small">con actividad en los últimos 5 minutos</span></Card.Title>
              {conectados.length === 0 ? (
                <p className="text-secondary mb-0">Nadie está usando el MCP ni la API en este momento.</p>
              ) : (
                <div className="d-flex flex-wrap gap-2">
                  {conectados.map((t) => (
                    <span key={t.id} className="conectado">
                      <span className="dot-on" />
                      <Avatar user={t.user} />
                      {t.user.name} <span className="text-secondary">· {t.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                <Card.Title className="mb-0">Tokens del equipo <span className="text-secondary fw-normal small">{visibles.length}</span></Card.Title>
                <Form.Check type="switch" id="it-rev" className="small" label="Ver revocados" checked={verRevocados} onChange={(e) => setVerRevocados(e.target.checked)} />
              </div>
              <div className="kpi-table-wrap">
                <table className="table table-sm mb-0 tabular kpi-table">
                  <thead><tr><th>Persona</th><th>Token</th><th>Prefijo</th><th>Creado</th><th>Último uso</th><th className="text-end">Llamadas 7d</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {visibles.map((t) => (
                      <tr key={t.id} className={t.revokedAt ? 'text-secondary' : ''}>
                        <td><span className="d-inline-flex align-items-center gap-2"><Avatar user={t.user} />{t.user.name}</span></td>
                        <td>{t.name}</td>
                        <td><code>{t.prefix}…</code></td>
                        <td className="text-nowrap">{fmtFechaHora(t.createdAt)}</td>
                        <td className="text-nowrap">{t.lastUsedAt ? hace(t.lastUsedAt) : <span className="text-secondary">nunca</span>}</td>
                        <td className="text-end">{t.calls7d || '·'}</td>
                        <td>{t.revokedAt ? <Badge bg="secondary-subtle" text="secondary">revocado</Badge> : t.connected ? <Badge bg="success-subtle" text="success">conectado</Badge> : <Badge bg="light" text="dark">activo</Badge>}</td>
                        <td className="text-end">{!t.revokedAt && <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => revocar(t)}>Revocar</Button>}</td>
                      </tr>
                    ))}
                    {visibles.length === 0 && <tr><td colSpan={8} className="text-secondary">Nadie ha creado tokens todavía.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                <Card.Title className="mb-0">Registro de llamadas <span className="text-secondary fw-normal small">herramientas MCP y peticiones a la API · se guardan 90 días</span></Card.Title>
                <Form.Select size="sm" style={{ width: 'auto' }} value={userId} onChange={(e) => setUserId(e.target.value)}>
                  <option value="">Todas las personas</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Form.Select>
              </div>
              {!logs ? (
                <Skeleton className="skeleton-rounded" width="100%" height={120} />
              ) : logs.length === 0 ? (
                <p className="text-secondary mb-0">Sin llamadas todavía.</p>
              ) : (
                <div className="kpi-table-wrap">
                  <table className="table table-sm mb-0 tabular kpi-table log-table">
                    <thead><tr><th>Cuándo</th><th>Persona</th><th>Vía</th><th>Acción</th><th>Detalle</th><th className="text-end">ms</th><th></th></tr></thead>
                    <tbody>
                      {logs.map((l) => (
                        <tr key={l.id} className={l.ok ? '' : 'table-danger'}>
                          <td className="text-nowrap" title={fmtFechaHora(l.createdAt)}>{hace(l.createdAt)}</td>
                          <td className="text-nowrap">{l.user.name} <span className="text-secondary small">· {l.tokenName}</span></td>
                          <td><Badge bg={l.source === 'mcp' ? 'primary-subtle' : 'secondary-subtle'} text={l.source === 'mcp' ? 'primary' : 'secondary'}>{l.source === 'mcp' ? 'MCP' : 'API'}</Badge></td>
                          <td><code>{l.action}</code></td>
                          <td className="detalle">{l.detail}</td>
                          <td className="text-end">{l.ms}</td>
                          <td>{l.ok ? '' : <Badge bg="danger-subtle" text="danger">error</Badge>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {hayMas && <div className="text-center mt-2"><Button size="sm" variant="outline-secondary" onClick={cargarMas}>Cargar {TRAMO} más</Button></div>}
                </div>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
}
