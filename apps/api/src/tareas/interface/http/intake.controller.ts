import { Body, Controller, Get, HttpCode, Ip, Param, ParseIntPipe, Post, Put, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IntakeConfigDto, PublicFormDto, PublicFormResultDto, PublicFormSubmitDto, UpdateIntakeDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, Public, RequireFeature } from '../../../auth/interface/http/decorators';
import { FicheroSubido } from '../../application/attachments.service';
import { IntakeService } from '../../application/intake.service';
import { MAX_IMAGEN_BYTES, MAX_IMAGENES } from '../../domain/incidencia';

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

  /**
   * JSON (sin imágenes) o multipart con los campos y hasta 5 imágenes en `imagenes`. El límite de
   * tamaño lo corta ya multer; el tipo y el número los revisa el servicio antes de crear la tarea.
   */
  @Post()
  @HttpCode(201)
  @UseInterceptors(FilesInterceptor('imagenes', MAX_IMAGENES + 1, { limits: { fileSize: MAX_IMAGEN_BYTES } }))
  submit(
    @Param('token') token: string,
    @Body() body: PublicFormSubmitDto,
    @Ip() ip: string,
    @UploadedFiles() imagenes: FicheroSubido[] | undefined,
  ): Promise<PublicFormResultDto> {
    return this.intake.submit(token, body, ip, imagenes ?? []);
  }
}
