import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { FileStorage } from '../application/storage.port';

/** Adjuntos en disco local (desarrollo). Carpeta `uploads/` (gitignored), efímera en App Platform. */
export class DiskStorage implements FileStorage {
  readonly kind = 'disk' as const;
  constructor(private readonly base: string = process.env.UPLOADS_DIR ?? resolve(process.cwd(), 'uploads')) {}

  private path(key: string): string {
    const p = resolve(this.base, key);
    if (!p.startsWith(resolve(this.base))) throw new Error('Clave de fichero inválida.');
    return p;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
}

/** Sin almacenamiento configurado en producción: se avisa, no se pierden ficheros en silencio. */
export class OffStorage implements FileStorage {
  readonly kind = 'off' as const;
  private fail(): never {
    throw new Error('Los adjuntos están deshabilitados: configura SPACES_* en el entorno.');
  }
  put(): Promise<void> {
    return this.fail();
  }
  get(): Promise<Buffer> {
    return this.fail();
  }
  delete(): Promise<void> {
    return this.fail();
  }
}
