import type { CorreoConfigDto, CorreoPreferenciasDto, CorreoPruebaResultadoDto, CorreoRegistroDto, GuardarCorreoConfigDto, PerfilCorreoDto } from '@yorga/contracts';
import { apiFetch, errorMessage } from './api-client';

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** Adapter: correo saliente (administración; usuarios.gestionar). */
export class HttpCorreoGateway {
  async leer(): Promise<CorreoConfigDto> {
    const res = await apiFetch('/admin/correo');
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo cargar la configuración del correo.'));
    return res.json();
  }

  async guardar(dto: GuardarCorreoConfigDto): Promise<CorreoConfigDto> {
    const res = await apiFetch('/admin/correo', json('PUT', dto));
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo guardar la configuración del correo.'));
    return res.json();
  }

  async probar(para: string): Promise<CorreoPruebaResultadoDto> {
    const res = await apiFetch('/admin/correo/prueba', json('POST', { para }));
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo enviar la prueba.'));
    return res.json();
  }

  async registro(limit = 100): Promise<CorreoRegistroDto[]> {
    const res = await apiFetch(`/admin/correo/registro?limit=${limit}`);
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo cargar el registro de envíos.'));
    return res.json();
  }

  // ---- mis preferencias (cualquier persona con sesión) ----
  async misPreferencias(): Promise<PerfilCorreoDto> {
    const res = await apiFetch('/me/correo');
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudieron cargar tus preferencias de correo.'));
    return res.json();
  }

  async guardarMisPreferencias(dto: CorreoPreferenciasDto): Promise<PerfilCorreoDto> {
    const res = await apiFetch('/me/correo', json('PUT', dto));
    if (!res.ok) throw new Error(await errorMessage(res, 'No se pudieron guardar tus preferencias de correo.'));
    return res.json();
  }
}
