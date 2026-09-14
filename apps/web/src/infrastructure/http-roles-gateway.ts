import type { CreateRoleDto, RoleDto, UpdateRoleDto } from '@yorga/contracts';
import { apiFetch, errorMessage } from './api-client';

/** Adapter: administración de roles contra la API HTTP (endpoints con feature `roles.gestionar` · REQ-006). */
export class HttpRolesGateway {
  async list(): Promise<RoleDto[]> {
    const res = await apiFetch('/roles');
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudieron cargar los roles.'));
    return res.json();
  }

  async create(input: CreateRoleDto): Promise<RoleDto> {
    const res = await apiFetch('/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo crear el rol.'));
    return res.json();
  }

  async update(id: number, input: UpdateRoleDto): Promise<RoleDto> {
    const res = await apiFetch(`/roles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo actualizar el rol.'));
    return res.json();
  }
}
