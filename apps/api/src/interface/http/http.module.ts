import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { TareasModule } from '../../tareas/tareas.module';
import { ImportarModule } from '../../importar/importar.module';
import { CorreoModule } from '../../correo/correo.module';
import { HealthController } from './health.controller';

/** Módulo de la API HTTP: auth (guards globales) + tareas + import. */
@Module({
  imports: [AuthModule, TareasModule, ImportarModule, CorreoModule],
  controllers: [HealthController],
})
export class HttpModule {}
