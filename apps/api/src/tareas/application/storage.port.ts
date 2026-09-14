/** Puerto de salida: dónde viven los ficheros adjuntos (disco local en dev, Spaces/S3 en producción). */
export interface FileStorage {
  readonly kind: 'disk' | 's3' | 'off';
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
