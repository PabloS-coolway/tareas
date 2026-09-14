import { Body, Controller, Module, Post } from '@nestjs/common';
import { ClickUpImportResultDto } from '@yorga/contracts';
import { AuthModule } from '../auth/auth.module';
import { JwtPayload } from '../auth/application/auth.service';
import { CurrentUser, RequireFeature } from '../auth/interface/http/decorators';
import { TareasModule } from '../tareas/tareas.module';
import { ClickUpExport, ClickUpImportOptions } from './clickup-export.types';
import { ClickUpImportService } from './clickup-import.service';

@Controller('import')
export class ImportarController {
  constructor(private readonly clickup: ClickUpImportService) {}

  /** Cuerpo: `{ data: <export de scripts/clickup-export.mjs>, options?: { keys, adjuntos } }`. */
  @Post('clickup')
  @RequireFeature('proyectos.gestionar')
  clickupImport(@Body() body: { data: ClickUpExport; options?: ClickUpImportOptions }, @CurrentUser() me: JwtPayload): Promise<ClickUpImportResultDto> {
    return this.clickup.importar(body?.data, body?.options ?? {}, me.sub);
  }
}

/** Importación desde ClickUp (migración inicial y re-ejecuciones idempotentes). */
@Module({
  imports: [AuthModule, TareasModule],
  controllers: [ImportarController],
  providers: [ClickUpImportService],
})
export class ImportarModule {}
