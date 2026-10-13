import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CorreoController } from './interface/http/correo.controller';

/** Pantalla de admin del correo. El ServicioCorreo lo provee AuthModule (ver correo.providers.ts). */
@Module({
  imports: [AuthModule],
  controllers: [CorreoController],
})
export class CorreoModule {}
