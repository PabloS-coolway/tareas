import { clearToken, getToken } from './session';

/**
 * fetch contra /api con el token adjunto. Ante un 401 limpia la sesión y
 * redirige al login (una sola vez), de modo que los gateways no lo repiten.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    if (!location.pathname.startsWith('/login')) location.assign('/login');
  }
  return res;
}

/** Extrae el mensaje de error del cuerpo JSON, con un fallback legible. */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    return (await res.json()).message ?? fallback;
  } catch {
    return fallback;
  }
}
