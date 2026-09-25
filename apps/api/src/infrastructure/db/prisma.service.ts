import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { conTopeDeConexiones } from './pool';

/** Cliente Prisma como servicio NestJS (conexión lazy; cierra al apagar). Uno solo en toda la API: lo exporta AuthModule. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const url = conTopeDeConexiones(process.env.DATABASE_URL, Number(process.env.DB_POOL_MAX) || 5);
    super(url ? { datasources: { db: { url } } } : undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
