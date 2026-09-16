import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { ApiTokenService } from '../auth/application/api-token.service';

type Req = IncomingMessage & { body?: unknown; params?: Record<string, string>; headers: IncomingMessage['headers'] };
type Res = ServerResponse;

/**
 * MCP remoto por HTTP (Streamable HTTP, sin estado): el mismo juego de herramientas que el paquete stdio, pero
 * servido por la propia API para conectarlo desde Claude sin instalar nada.
 *
 *   POST/GET/DELETE /api/mcp            → Authorization: Bearer tk_…  (Claude Code, Claude Desktop, SDKs)
 *   POST/GET/DELETE /api/mcp/t/<token>  → token en la ruta, para conectores que no admiten cabeceras (claude.ai)
 *
 * Cada petición crea un servidor efímero que actúa EN NOMBRE del dueño del token, llamando a la API por loopback
 * con ese mismo token: así aplican exactamente los mismos permisos y la misma lógica que en la web.
 *
 * El SDK de MCP y las herramientas (@yorga/tareas-mcp, compilado a ESM) se cargan con import() dinámico porque
 * la API es CommonJS; `new Function` evita que tsc convierta el import() en require().
 */
const importar = new Function('m', 'return import(m)') as (m: string) => Promise<Record<string, unknown>>;
type ApiFn = <T>(path: string, init?: RequestInit) => Promise<T>;
interface Servidor { connect(t: unknown): Promise<void>; close(): Promise<void> }
interface Transporte { handleRequest(req: IncomingMessage, res: ServerResponse, body?: unknown): Promise<void>; close(): Promise<void> }

async function cargar(): Promise<{ crearServidor: (api: ApiFn) => Servidor; Transport: new (o: { sessionIdGenerator: undefined }) => Transporte }> {
  const raizMcp = dirname(require.resolve('@yorga/tareas-mcp/package.json'));
  const [h, t] = await Promise.all([importar(join(raizMcp, 'dist', 'herramientas.js')), importar('@modelcontextprotocol/sdk/server/streamableHttp.js')]);
  return { crearServidor: h.crearServidor as (api: ApiFn) => Servidor, Transport: t.StreamableHTTPServerTransport as new (o: { sessionIdGenerator: undefined }) => Transporte };
}

export function crearManejadorMcp(apiTokens: ApiTokenService, port: number | string) {
  const base = `http://127.0.0.1:${port}/api`;
  let modulos: ReturnType<typeof cargar> | null = null;

  return async function manejar(req: Req, res: Res): Promise<void> {
    // CORS: este manejador va por fuera de Nest (y de su enableCors).
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const cab = String(req.headers.authorization ?? '');
    const token = req.params?.token ?? (cab.toLowerCase().startsWith('bearer ') ? cab.slice(7).trim() : '');
    const quien = token ? await apiTokens.resolve(token) : null;
    if (!quien) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'Token de API no válido. Crea uno en «Tokens de API» y envíalo como Authorization: Bearer tk_…' }, id: null }));
      return;
    }

    const api: ApiFn = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
      const r = await fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
      if (!r.ok) {
        let msg = `HTTP ${r.status}`;
        try {
          msg = ((await r.json()) as { message?: string }).message ?? msg;
        } catch {
          /* sin cuerpo */
        }
        throw new Error(msg);
      }
      return r.status === 204 ? (undefined as T) : ((await r.json()) as T);
    };

    try {
      modulos ??= cargar();
      const { crearServidor, Transport } = await modulos;
      const server = crearServidor(api);
      const transport = new Transport({ sessionIdGenerator: undefined });
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, await cuerpo(req));
    } catch (e) {
      modulos = null;
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: `MCP no disponible: ${(e as Error).message}` }, id: null }));
      }
    }
  };
}

/** Cuerpo JSON: el que dejó el bodyParser de Nest o, si no pasó por él, se lee del stream. */
async function cuerpo(req: Req): Promise<unknown> {
  if (req.body !== undefined) return req.body;
  if (req.method !== 'POST') return undefined;
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  const texto = Buffer.concat(chunks).toString('utf8');
  return texto ? JSON.parse(texto) : undefined;
}
