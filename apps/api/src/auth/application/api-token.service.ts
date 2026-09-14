import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ApiTokenDto, CreatedApiTokenDto } from '@yorga/contracts';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { JwtPayload } from './auth.service';

/** Prefijo que distingue un token de API de un JWT en la cabecera Authorization. */
export const API_TOKEN_PREFIX = 'tk_';

const hash = (token: string): string => createHash('sha256').update(token).digest('hex');

/**
 * Tokens personales de API (para Claude/MCP y scripts). Se guarda SOLO el hash: si se filtra la base de
 * datos, los tokens no sirven. El secreto se enseña una única vez, al crearlo.
 */
@Injectable()
export class ApiTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: number): Promise<ApiTokenDto[]> {
    const rows = await this.prisma.apiToken.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: 'desc' } });
    return rows.map(toDto);
  }

  async create(userId: number, name: string): Promise<CreatedApiTokenDto> {
    const token = API_TOKEN_PREFIX + randomBytes(32).toString('base64url');
    const row = await this.prisma.apiToken.create({
      data: { userId, name: name.trim() || 'Token', tokenHash: hash(token), prefix: token.slice(0, API_TOKEN_PREFIX.length + 6) },
    });
    return { ...toDto(row), token };
  }

  async revoke(userId: number, id: number): Promise<void> {
    const row = await this.prisma.apiToken.findFirst({ where: { id, userId, revokedAt: null } });
    if (!row) throw new NotFoundException('Token no encontrado.');
    await this.prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  /** Resuelve un token a la identidad de su dueño (o null si no vale). Anota el último uso (como mucho 1/min). */
  async resolve(token: string): Promise<JwtPayload | null> {
    const row = await this.prisma.apiToken.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
    if (!row || row.revokedAt || !row.user.active) return null;
    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
      void this.prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }
    return { sub: row.user.id, email: row.user.email, name: row.user.name, role: row.user.role };
  }
}

function toDto(r: { id: number; name: string; prefix: string; lastUsedAt: Date | null; createdAt: Date }): ApiTokenDto {
  return { id: r.id, name: r.name, prefix: r.prefix, lastUsedAt: r.lastUsedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() };
}
