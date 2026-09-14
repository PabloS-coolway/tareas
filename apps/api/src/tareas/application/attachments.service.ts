import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AttachmentDto } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { ActivityService } from './activity.service';
import { FILE_STORAGE, FileStorage } from './storage.port';

export const MAX_ADJUNTO_BYTES = 15 * 1024 * 1024;

export interface FicheroSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const uploader = { select: { id: true, name: true, email: true } } as const;

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async list(taskId: number): Promise<AttachmentDto[]> {
    const rows = await this.prisma.attachment.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' }, include: { uploader } });
    return rows.map(toDto);
  }

  async add(taskId: number, file: FicheroSubido | undefined, actorId: number, clickupUrl: string | null = null): Promise<AttachmentDto> {
    if (!file?.buffer?.length) throw new BadRequestException('No llegó ningún fichero.');
    if (file.size > MAX_ADJUNTO_BYTES) throw new BadRequestException('El fichero supera los 15 MB.');
    if (!(await this.prisma.task.findUnique({ where: { id: taskId } }))) throw new NotFoundException('Tarea no encontrada.');
    if (this.storage.kind === 'off') throw new BadRequestException('Los adjuntos están deshabilitados en este entorno (falta SPACES_*).');

    const filename = nombreSeguro(file.originalname);
    const storageKey = `tasks/${taskId}/${randomUUID()}-${filename}`;
    await this.storage.put(storageKey, file.buffer, file.mimetype || 'application/octet-stream');
    const row = await this.prisma.$transaction(async (tx) => {
      const a = await tx.attachment.create({
        data: { taskId, uploaderId: actorId, filename, mimeType: file.mimetype || 'application/octet-stream', size: file.size, storageKey, clickupUrl },
        include: { uploader },
      });
      await this.activity.record({ taskId, actorId, action: 'attachment', after: filename }, tx);
      return a;
    });
    return toDto(row);
  }

  async download(id: number): Promise<{ filename: string; mimeType: string; data: Buffer }> {
    const a = await this.prisma.attachment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Adjunto no encontrado.');
    return { filename: a.filename, mimeType: a.mimeType, data: await this.storage.get(a.storageKey) };
  }

  async remove(id: number, actorId: number): Promise<void> {
    const a = await this.prisma.attachment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Adjunto no encontrado.');
    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.delete({ where: { id } });
      await this.activity.record({ taskId: a.taskId, actorId, action: 'attachment_removed', before: a.filename }, tx);
    });
    await this.storage.delete(a.storageKey).catch(() => undefined); // el registro ya no está; un resto en disco no es grave
  }
}

/** Sin rutas, sin caracteres raros, con extensión. */
export function nombreSeguro(original: string): string {
  const base = (original || 'fichero').split(/[\\/]/).pop() as string;
  const limpio = base.normalize('NFKD').replace(/[^\w.\-() ]+/g, '_').replace(/\s+/g, ' ').trim();
  return (limpio || 'fichero').slice(0, 150);
}

function toDto(r: { id: number; taskId: number; filename: string; mimeType: string; size: number; createdAt: Date; uploader: { id: number; name: string; email: string } }): AttachmentDto {
  return {
    id: r.id,
    taskId: r.taskId,
    filename: r.filename,
    mimeType: r.mimeType,
    size: r.size,
    uploader: r.uploader,
    createdAt: r.createdAt.toISOString(),
    url: `/attachments/${r.id}/download`,
  };
}
