import { Body, Controller, Get, HttpCode, Ip, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { IntakeConfigDto, PublicFormDto, PublicFormResultDto, PublicFormSubmitDto, UpdateIntakeDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, Public, RequireFeature } from '../../../auth/interface/http/decorators';
import { IntakeService } from '../../application/intake.service';

/** Configuración del formulario público y de los plazos de un proyecto. */
@Controller('projects/:id/intake')
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  @Get()
  @RequireFeature('proyectos.gestionar')
  get(@Param('id', ParseIntPipe) id: number): Promise<IntakeConfigDto> {
    return this.intake.config(id);
  }

  @Put()
  @RequireFeature('proyectos.gestionar')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateIntakeDto, @CurrentUser() me: JwtPayload): Promise<IntakeConfigDto> {
    return this.intake.update(id, body, me.sub);
  }
}

/** El formulario en sí: SIN cuenta. Sólo sirve con el enlace secreto del proyecto. */
@Controller('public/forms/:token')
@Public()
export class PublicFormController {
  constructor(private readonly intake: IntakeService) {}

  @Get()
  form(@Param('token') token: string): Promise<PublicFormDto> {
    return this.intake.form(token);
  }

  @Post()
  @HttpCode(201)
  submit(@Param('token') token: string, @Body() body: PublicFormSubmitDto, @Ip() ip: string): Promise<PublicFormResultDto> {
    return this.intake.submit(token, body, ip);
  }
}
