import { Body, Controller, Get, Put } from '@nestjs/common';
import { CorreoPreferenciasDto, PerfilCorreoDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser } from '../../../auth/interface/http/decorators';
import { PreferenciasCorreoService } from '../../application/preferencias-correo.service';

/**
 * Mis preferencias de correo. Siempre sobre quien llama (sesión o token): no hay id de usuario en la ruta, así que
 * nadie puede ver ni cambiar las de otro, tampoco un admin. Basta con tener sesión (sin feature).
 */
@Controller('me/correo')
export class PerfilCorreoController {
  constructor(private readonly preferencias: PreferenciasCorreoService) {}

  @Get()
  leer(@CurrentUser() me: JwtPayload): Promise<PerfilCorreoDto> {
    return this.preferencias.leer(me.sub);
  }

  @Put()
  guardar(@Body() body: CorreoPreferenciasDto, @CurrentUser() me: JwtPayload): Promise<PerfilCorreoDto> {
    return this.preferencias.guardar(me.sub, body);
  }
}
