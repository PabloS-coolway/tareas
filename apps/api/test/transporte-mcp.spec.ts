import { metodoAdmitido, OPCIONES_TRANSPORTE } from '../src/mcp/transporte-mcp';

// Regresión TAREAS-30: con SSE, el proxy de DigitalOcean rompía la respuesta por HTTP/1.1 y Claude Code
// (Windows) acababa en timeout. El MCP responde JSON normal y sin sesión.
describe('transporte del MCP remoto', () => {
  it('responde JSON, no SSE, y no abre sesión', () => {
    expect(OPCIONES_TRANSPORTE.enableJsonResponse).toBe(true);
    expect(OPCIONES_TRANSPORTE.sessionIdGenerator).toBeUndefined();
  });

  it('atiende POST y DELETE; GET (canal SSE) no', () => {
    expect(metodoAdmitido('POST')).toBe(true);
    expect(metodoAdmitido('post')).toBe(true);
    expect(metodoAdmitido('DELETE')).toBe(true);
    expect(metodoAdmitido('GET')).toBe(false);
    expect(metodoAdmitido(undefined)).toBe(false);
  });
});
