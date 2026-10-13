/**
 * Cómo responde el MCP remoto. Es sin sesión y no manda avisos por iniciativa propia, así que no necesita SSE:
 * responde JSON normal. Con SSE, el proxy de DigitalOcean entregaba por HTTP/1.1 `transfer-encoding: chunked` con el
 * cuerpo sin trocear y los clientes Node (Claude Code en Windows) lo rechazaban y acababan en timeout (TAREAS-30).
 */
export const OPCIONES_TRANSPORTE = { sessionIdGenerator: undefined, enableJsonResponse: true } as const;

/** Métodos que atiende el MCP. GET abriría un canal SSE que aquí no existe: el protocolo permite contestar 405. */
export const METODOS_MCP = ['POST', 'DELETE'] as const;

export function metodoAdmitido(metodo: string | undefined): boolean {
  return (METODOS_MCP as readonly string[]).includes(String(metodo ?? '').toUpperCase());
}
