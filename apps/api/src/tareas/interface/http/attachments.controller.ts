import { Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, RequireFeature } from '../../../auth/interface/http/decorators';
import { AttachmentsService, FicheroSubido, MAX_ADJUNTO_BYTES } from '../../application/attachments.service';

/** Lo mínimo de la respuesta de Express que usamos para las cabeceras de descarga. */
interface ResHeaders {
  set(headers: Record<string, string>): unknown;
}

@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get('tasks/:id/attachments')
  @RequireFeature('tareas.ver')
  list(@Param('id', ParseIntPipe) id: number): Promise<AttachmentDto[]> {
    return this.attachments.list(id);
  }

  /** Subida multipart (campo `file`). El fichero se recibe en memoria y se pasa al almacenamiento. */
  @Post('tasks/:id/attachments')
  @RequireFeature('tareas.editar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ADJUNTO_BYTES } }))
  upload(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: FicheroSubido | undefined, @CurrentUser() me: JwtPayload): Promise<AttachmentDto> {
    return this.attachments.add(id, file, me.sub);
  }

  @Get('attachments/:id/download')
  @RequireFeature('tareas.ver')
  async download(@Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) res: ResHeaders): Promise<StreamableFile> {
    const { filename, mimeType, data } = await this.attachments.download(id);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(data.length),
    });
    return new StreamableFile(data);
  }

  @Delete('attachments/:id')
  @RequireFeature('tareas.editar')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() me: JwtPayload): Promise<void> {
    return this.attachments.remove(id, me.sub);
  }
}
