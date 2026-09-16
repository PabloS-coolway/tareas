#!/usr/bin/env node
/**
 * MCP de Tareas Yorga (stdio): expone la API como herramientas para Claude (Claude Code, Claude Desktop…).
 *
 * Config: TAREAS_URL (p. ej. https://tareas.grupoyorga.com) y TAREAS_TOKEN (token personal creado en
 * la pantalla «Tokens de API»). Actúa EN NOMBRE del dueño del token, con sus mismos permisos.
 *
 * Alternativa sin instalar nada: el MCP remoto por HTTP en <TAREAS_URL>/api/mcp (ver README).
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { crearServidor } from './herramientas.js';

const URL_BASE = (process.env.TAREAS_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.TAREAS_TOKEN ?? '';
if (!URL_BASE || !TOKEN) {
  console.error('Faltan TAREAS_URL y/o TAREAS_TOKEN en el entorno.');
  process.exit(1);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${URL_BASE}/api${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      msg = ((await res.json()) as { message?: string }).message ?? msg;
    } catch {
      /* sin cuerpo */
    }
    throw new Error(msg);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

await crearServidor(api).connect(new StdioServerTransport());
