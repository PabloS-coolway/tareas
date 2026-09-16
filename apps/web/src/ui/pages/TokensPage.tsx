import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { Clipboard, Trash } from 'react-bootstrap-icons';
import type { ApiTokenDto, CreatedApiTokenDto } from '@yorga/contracts';
import { tokensGateway } from '../composition';
import { fmtFechaHora, hace } from '../components/tareas-ui';

export function TokensPage() {
  const [tokens, setTokens] = useState<ApiTokenDto[]>([]);
  const [name, setName] = useState('');
  const [nuevo, setNuevo] = useState<CreatedApiTokenDto | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const load = () => tokensGateway.list().then(setTokens).catch((e) => setError((e as Error).message));
  useEffect(() => {
    void load();
  }, []);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      setNuevo(await tokensGateway.create(name || 'Claude'));
      setName('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function revocar(t: ApiTokenDto) {
    if (!window.confirm(`¿Revocar el token "${t.name}"? Lo que lo use dejará de funcionar.`)) return;
    try {
      await tokensGateway.revoke(t.id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const apiUrl = `${location.origin}`;
  const mcpConfig = `{
  "mcpServers": {
    "tareas-yorga": {
      "command": "npx",
      "args": ["-y", "@yorga/tareas-mcp"],
      "env": { "TAREAS_URL": "${apiUrl}", "TAREAS_TOKEN": "${nuevo?.token ?? '<tu token>'}" }
    }
  }
}`;

  return (
    <div className="page page-wide">
      <header className="page-head mb-4">
        <h1 className="h4 mb-1">Tokens de API</h1>
        <p className="text-secondary mb-0">Para que Claude (MCP) o un script trabajen con tus tareas en tu nombre. El token se enseña una sola vez.</p>
      </header>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>⚠ {error}</Alert>}

      {nuevo && (
        <Alert variant="success" onClose={() => setNuevo(null)} dismissible>
          <div className="fw-bold mb-2">Token «{nuevo.name}» creado. Cópialo ahora: no se volverá a mostrar.</div>
          <div className="d-flex gap-2 align-items-start">
            <div className="token-box flex-grow-1">{nuevo.token}</div>
            <Button size="sm" variant="outline-secondary" onClick={() => navigator.clipboard.writeText(nuevo.token).then(() => setCopiado(true))}><Clipboard /> {copiado ? 'copiado' : 'copiar'}</Button>
          </div>
          <div className="small mt-3 mb-1"><b>MCP remoto (recomendado, sin instalar nada).</b> En Claude Code:</div>
          <pre className="token-box mb-2">{`claude mcp add --transport http tareas-yorga ${apiUrl}/api/mcp --header "Authorization: Bearer ${nuevo?.token ?? '<tu token>'}"`}</pre>
          <div className="small mb-1">En claude.ai o Claude Desktop (Ajustes → Conectores → Añadir conector personalizado), la URL con el token dentro:</div>
          <pre className="token-box mb-2">{`${apiUrl}/api/mcp/t/${nuevo?.token ?? '<tu token>'}`}</pre>
          <div className="small mb-1">Alternativa local (paquete stdio), en <code>.mcp.json</code> o <code>claude_desktop_config.json</code>:</div>
          <pre className="token-box mb-0">{mcpConfig}</pre>
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Body>
          <Card.Title className="mb-3">Nuevo token</Card.Title>
          <Form onSubmit={crear} className="d-flex gap-2 flex-wrap">
            <Form.Control id="tk-name" style={{ maxWidth: 320 }} placeholder="Nombre (p. ej. Claude en mi portátil)" value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" className="btn-brand" disabled={saving}>{saving ? <Spinner size="sm" animation="border" /> : 'Crear token'}</Button>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title className="mb-3">Tus tokens ({tokens.length})</Card.Title>
          {tokens.length === 0 ? (
            <div className="text-secondary small">Sin tokens activos.</div>
          ) : (
            tokens.map((t) => (
              <div key={t.id} className="adjunto">
                <span className="name"><b>{t.name}</b> <span className="task-key ms-2">{t.prefix}…</span></span>
                <span className="small text-secondary">creado {fmtFechaHora(t.createdAt)}{t.lastUsedAt && <> · usado {hace(t.lastUsedAt)}</>}</span>
                <Button size="sm" variant="link" className="text-danger p-0" title="Revocar" onClick={() => revocar(t)}><Trash /></Button>
              </div>
            ))
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
