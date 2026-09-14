import { Provider } from '@nestjs/common';
import { FILE_STORAGE, FileStorage } from '../application/storage.port';
import { DiskStorage, OffStorage } from './disk-storage';
import { S3Storage, s3ConfigFromEnv } from './s3-storage';

/** Elige el almacenamiento: Spaces si está configurado; si no, disco en desarrollo y "apagado" en producción. */
export function crearStorage(env: NodeJS.ProcessEnv = process.env): FileStorage {
  const cfg = s3ConfigFromEnv(env);
  if (cfg) return new S3Storage(cfg);
  if (env.NODE_ENV === 'production') {
    console.warn('⚠  Adjuntos deshabilitados: no hay SPACES_* en el entorno.');
    return new OffStorage();
  }
  return new DiskStorage();
}

export const storageProvider: Provider = { provide: FILE_STORAGE, useFactory: () => crearStorage() };
