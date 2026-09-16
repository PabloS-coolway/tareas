import type { AdminTokenDto, ApiTokenDto, CreatedApiTokenDto, TokenLogDto } from '@yorga/contracts';
import { apiFetch, errorMessage } from './api-client';

/** Adapter: tokens de API del propio usuario. */
export class HttpTokensGateway {
  async list(): Promise<ApiTokenDto[]> {
    const res = await apiFetch('/tokens');
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudieron cargar los tokens.'));
    return res.json();
  }

  async create(name: string): Promise<CreatedApiTokenDto> {
    const res = await apiFetch('/tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo crear el token.'));
    return res.json();
  }

  async revoke(id: number): Promise<void> {
    const res = await apiFetch(`/tokens/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo revocar el token.'));
  }

  // ---- administración (usuarios.gestionar) ----
  async listAll(): Promise<AdminTokenDto[]> {
    const res = await apiFetch('/admin/tokens');
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudieron cargar los tokens del equipo.'));
    return res.json();
  }
  async revokeAny(id: number): Promise<void> {
    const res = await apiFetch(`/admin/tokens/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo revocar el token.'));
  }
  async logs(filtro: { userId?: number; tokenId?: number; limit?: number; before?: number } = {}): Promise<TokenLogDto[]> {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filtro)) if (v) p.set(k, String(v));
    const res = await apiFetch(`/admin/tokens/logs?${p}`);
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo cargar el registro.'));
    return res.json();
  }
}
