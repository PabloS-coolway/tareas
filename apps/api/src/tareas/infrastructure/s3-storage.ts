import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FileStorage } from '../application/storage.port';

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  key: string;
  secret: string;
}

/** Lee la configuración de Spaces del entorno; null si no está completa. */
export function s3ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): S3Config | null {
  const { SPACES_ENDPOINT, SPACES_REGION, SPACES_BUCKET, SPACES_KEY, SPACES_SECRET } = env;
  if (!SPACES_ENDPOINT || !SPACES_BUCKET || !SPACES_KEY || !SPACES_SECRET) return null;
  return { endpoint: SPACES_ENDPOINT, region: SPACES_REGION ?? 'fra1', bucket: SPACES_BUCKET, key: SPACES_KEY, secret: SPACES_SECRET };
}

/** Adjuntos en DigitalOcean Spaces (API S3). Privados: se sirven a través de la API, nunca por URL pública. */
export class S3Storage implements FileStorage {
  readonly kind = 's3' as const;
  private readonly client: S3Client;

  constructor(private readonly cfg: S3Config) {
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: { accessKeyId: cfg.key, secretAccessKey: cfg.secret },
    });
  }

  async put(key: string, data: Buffer, mimeType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: data, ContentType: mimeType, ACL: 'private' }));
  }

  async get(key: string): Promise<Buffer> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
    if (!out.Body) throw new Error('Fichero vacío.');
    return Buffer.from(await out.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }
}
