import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { HttpModule } from './http.module';
import { bootstrapAdmin } from '../../auth/bootstrap-admin';
import { bootstrapRoles } from '../../auth/bootstrap-roles';
import { PASSWORD_HASHER, PasswordHasher, USER_REPOSITORY, UserRepository } from '../../auth/application/ports';
import { PrismaService } from '../../infrastructure/db/prisma.service';

async function bootstrap(): Promise<void> {
  // bodyParser propio: el import de ClickUp manda un JSON grande (descripciones y comentarios de todo el equipo).
  const app = await NestFactory.create<NestExpressApplication>(HttpModule, { bodyParser: false });
  app.useBodyParser('json', { limit: '50mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '50mb' });
  app.setGlobalPrefix('api');
  app.enableCors(); // el front (Vite) corre en otro puerto en desarrollo

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API tareas escuchando en http://localhost:${port}/api`);

  // Roles de sistema (admin/miembro) y primer admin por variables de entorno. Idempotentes.
  try {
    const prisma = app.get(PrismaService, { strict: false });
    console.log(`[bootstrap] ${await bootstrapRoles(prisma)}`);
    const users = app.get<UserRepository>(USER_REPOSITORY, { strict: false });
    const hasher = app.get<PasswordHasher>(PASSWORD_HASHER, { strict: false });
    const msg = await bootstrapAdmin({
      findByEmail: (e) => users.findByEmail(e),
      create: (u) => users.create(u),
      hash: (p) => hasher.hash(p),
    });
    console.log(`[bootstrap] ${msg}`);
  } catch (e) {
    console.warn(`[bootstrap] no se pudo completar el arranque: ${(e as Error).message}`);
  }
}

void bootstrap();
