import type { CreateUserRequest, UpdateUserRequest, UserDto } from '@yorga/contracts';
import { apiFetch, errorMessage } from './api-client';

/** Adapter: administración de usuarios contra la API HTTP. */
export class HttpUsersGateway {
  async list(): Promise<UserDto[]> {
    const res = await apiFetch('/users');
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudieron cargar los usuarios.'));
    return res.json();
  }

  async create(input: CreateUserRequest): Promise<UserDto> {
    const res = await apiFetch('/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo crear el usuario.'));
    return res.json();
  }

  async update(id: number, input: UpdateUserRequest): Promise<UserDto> {
    const res = await apiFetch(`/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo actualizar el usuario.'));
    return res.json();
  }

  /** Resetea la contraseña de OTRO usuario (feature `usuarios.password`). */
  async resetearPassword(id: number, password: string): Promise<void> {
    const res = await apiFetch(`/users/${id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo resetear la contraseña.'));
  }
}
