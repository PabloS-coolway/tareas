import { BadRequestException, Body, Controller, Get, HttpCode, Post, Put, Query } from '@nestjs/common';
import { ErrorCorreo, ServicioCorreo, type ConfigCorreoPanel } from '@modulos/correo';
import { CorreoConfigDto, CorreoPruebaDto, CorreoPruebaResultadoDto, CorreoRegistroDto, GuardarCorreoConfigDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, RequireFeature } from '../../../auth/interface/http/decorators';
import { PROPIETARIO_CORREO, urlPublica } from '../../correo.providers';

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toDto(p: ConfigCorreoPanel): CorreoConfigDto {
  return {
    ...p,
    avisosDesde: iso(p.avisosDesde),
    actualizadoEn: iso(p.actualizadoEn),
    sugerencia: { remitenteNombre: 'Tareas Yorga', marcaNombre: 'Tareas Yorga', url: urlPublica() },
  };
}

/** Los errores de configuración del motor se enseñan tal cual (400); el resto sigue su curso. */
async function conMensaje<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    if (e instanceof ErrorCorreo) throw new BadRequestException(e.message);
    throw e;
  }
}

/** Administración del correo saliente: proveedor, prueba y registro. Mismo permiso que Integraciones. */
@Controller('admin/correo')
export class CorreoController {
  constructor(private readonly correo: ServicioCorreo) {}

  @Get()
  @RequireFeature('usuarios.gestionar')
  async leer(): Promise<CorreoConfigDto> {
    return toDto(await this.correo.leerParaPanel(PROPIETARIO_CORREO));
  }

  @Put()
  @RequireFeature('usuarios.gestionar')
  async guardar(@Body() body: GuardarCorreoConfigDto, @CurrentUser() me: JwtPayload): Promise<CorreoConfigDto> {
    return toDto(await conMensaje(() => this.correo.configurar(PROPIETARIO_CORREO, body, me.name)));
  }

  @Post('prueba')
  @HttpCode(200)
  @RequireFeature('usuarios.gestionar')
  probar(@Body() body: CorreoPruebaDto, @CurrentUser() me: JwtPayload): Promise<CorreoPruebaResultadoDto> {
    return this.correo.probar(PROPIETARIO_CORREO, String(body?.para || me.email).trim());
  }

  @Get('registro')
  @RequireFeature('usuarios.gestionar')
  async registro(@Query('limit') limit?: string): Promise<CorreoRegistroDto[]> {
    const rows = await this.correo.registro(PROPIETARIO_CORREO, limit && /^\d+$/.test(limit) ? Number(limit) : 100);
    return rows.map((r) => ({ ...r, id: Number(r.id), creadoEn: r.creadoEn.toISOString(), enviadoEn: iso(r.enviadoEn), proximoIntento: iso(r.proximoIntento) }));
  }
}
