import type { LoginResponse, UserDto } from '@yorga/contracts';
import { apiFetch, errorMessage } from './api-client';

/** Adapter: autenticación contra la API HTTP. */
export class HttpAuthGateway {
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo iniciar sesión.'));
    return res.json();
  }

  /** Recupera el usuario del token guardado (para restaurar la sesión al recargar). */
  async me(): Promise<UserDto> {
    const res = await apiFetch('/auth/me');
    if (!res.ok) throw new Error('Sesión no válida.');
    return res.json();
  }

  /** El propio usuario cambia su contraseña (exige la actual). */
  async cambiarPassword(actual: string, nueva: string): Promise<void> {
    const res = await apiFetch('/auth/cambiar-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual, nueva }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo cambiar la contraseña.'));
  }
}
