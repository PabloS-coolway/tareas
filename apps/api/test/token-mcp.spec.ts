import { cabeceraWwwAuthenticate, leerToken, mensajeToken } from '../src/mcp/token-mcp';

describe('token del MCP remoto', () => {
  it('acepta el token por cabecera Bearer (sin distinguir mayúsculas) o por la ruta', () => {
    expect(leerToken('Bearer tk_abc', undefined)).toEqual({ token: 'tk_abc', motivo: null });
    expect(leerToken('bearer   tk_abc  ', undefined)).toEqual({ token: 'tk_abc', motivo: null });
    expect(leerToken(undefined, 'tk_ruta')).toEqual({ token: 'tk_ruta', motivo: null });
  });

  it('el token de la ruta manda sobre la cabecera', () => {
    expect(leerToken('Bearer tk_cabecera', 'tk_ruta').token).toBe('tk_ruta');
  });

  it('dice por qué no hay token utilizable', () => {
    expect(leerToken(undefined, undefined).motivo).toBe('sin-token');
    expect(leerToken('   ', undefined).motivo).toBe('sin-token');
    expect(leerToken('tk_abc', undefined).motivo).toBe('sin-bearer');
    expect(leerToken('Bearer', undefined).motivo).toBe('bearer-vacio');
    expect(leerToken('Bearer   ', undefined).motivo).toBe('bearer-vacio');
    expect(leerToken('Bearer abc', undefined).motivo).toBe('formato');
  });

  // Regresión TAREAS-30: un cliente que no sustituye su configuración manda la plantilla tal cual y,
  // con un 401 genérico, Claude Code se quedaba buscando OAuth hasta el timeout.
  it('detecta la plantilla sin rellenar del plugin', () => {
    expect(leerToken('Bearer ${user_config.tareas_token}', undefined).motivo).toBe('plantilla-sin-rellenar');
    expect(leerToken(undefined, '${user_config.tareas_token}').motivo).toBe('plantilla-sin-rellenar');
    expect(mensajeToken('plantilla-sin-rellenar')).toContain('/api/mcp/t/tk_');
  });

  it('la cabecera WWW-Authenticate es Bearer, sin anunciar OAuth y sin comillas rotas', () => {
    const c = cabeceraWwwAuthenticate('plantilla-sin-rellenar');
    expect(c.startsWith('Bearer realm="tareas-yorga", error="invalid_request"')).toBe(true);
    expect(c).not.toContain('resource_metadata');
    expect((c.match(/"/g) ?? []).length % 2).toBe(0);
    expect(cabeceraWwwAuthenticate('desconocido')).toContain('error="invalid_token"');
  });

  // Regresión: con acentos o «» en la cabecera, Node lanza ERR_INVALID_CHAR y el 401 se convertía en un 500.
  it('la cabecera WWW-Authenticate es ASCII imprimible para todos los motivos', () => {
    for (const m of ['sin-token', 'sin-bearer', 'bearer-vacio', 'plantilla-sin-rellenar', 'formato', 'desconocido'] as const) {
      expect(cabeceraWwwAuthenticate(m)).toMatch(/^[\x20-\x7e]+$/);
    }
  });
});
