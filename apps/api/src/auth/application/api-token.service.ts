import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AdminTokenDto, ApiTokenDto, CreatedApiTokenDto, TokenLogDto } from '@yorga/contracts';
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
  async resolve(token: string): Promise<(JwtPayload & { tokenId: number }) | null> {
    const row = await this.prisma.apiToken.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
    if (!row || row.revokedAt || !row.user.active) return null;
    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
      void this.prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }
    return { sub: row.user.id, email: row.user.email, name: row.user.name, role: row.user.role, tokenId: row.id };
  }

  /** Apunta una llamada (no bloquea: los errores de registro se ignoran). */
  log(e: { tokenId: number; userId: number; source: 'mcp' | 'api'; action: string; detail?: string | null; ok: boolean; ms: number }): void {
    void this.prisma.apiTokenLog
      .create({ data: { tokenId: e.tokenId, userId: e.userId, source: e.source, action: e.action.slice(0, 120), detail: e.detail ? e.detail.slice(0, 300) : null, ok: e.ok, ms: Math.max(0, Math.round(e.ms)) } })
      .catch(() => undefined);
  }

  // ---------- Administración ----------

  /** Todos los tokens del equipo con uso reciente (para «Integraciones»). */
  async listAll(): Promise<AdminTokenDto[]> {
    const d7 = new Date(Date.now() - 7 * 86_400_000);
    const d5m = new Date(Date.now() - 5 * 60_000);
    const [rows, calls, recientes] = await Promise.all([
      this.prisma.apiToken.findMany({ include: { user: { select: { id: true, name: true, email: true } } }, orderBy: [{ revokedAt: 'asc' }, { lastUsedAt: { sort: 'desc', nulls: 'last' } }] }),
      this.prisma.apiTokenLog.groupBy({ by: ['tokenId'], where: { createdAt: { gte: d7 } }, _count: { _all: true } }),
      this.prisma.apiTokenLog.findMany({ where: { createdAt: { gte: d5m } }, select: { tokenId: true }, distinct: ['tokenId'] }),
    ]);
    const c = new Map(calls.map((x) => [x.tokenId, x._count._all]));
    const on = new Set(recientes.map((r) => r.tokenId));
    return rows.map((r) => ({ ...toDto(r), user: r.user, revokedAt: r.revokedAt?.toISOString() ?? null, calls7d: c.get(r.id) ?? 0, connected: on.has(r.id) || (!!r.lastUsedAt && r.lastUsedAt >= d5m) }));
  }

  /** Revoca el token de cualquiera (administración). */
  async revokeAny(id: number): Promise<void> {
    const row = await this.prisma.apiToken.findFirst({ where: { id, revokedAt: null } });
    if (!row) throw new NotFoundException('Token no encontrado o ya revocado.');
    await this.prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async logs(filtro: { userId?: number; tokenId?: number; limit?: number; before?: number }): Promise<TokenLogDto[]> {
    const rows = await this.prisma.apiTokenLog.findMany({
      where: { ...(filtro.userId ? { userId: filtro.userId } : {}), ...(filtro.tokenId ? { tokenId: filtro.tokenId } : {}), ...(filtro.before ? { id: { lt: filtro.before } } : {}) },
      orderBy: { id: 'desc' },
      take: Math.min(Math.max(filtro.limit ?? 100, 1), 500),
      include: { token: { select: { name: true, user: { select: { id: true, name: true, email: true } } } } },
    });
    return rows.map((r) => ({ id: r.id, tokenId: r.tokenId, tokenName: r.token.name, user: r.token.user, source: r.source as 'mcp' | 'api', action: r.action, detail: r.detail, ok: r.ok, ms: r.ms, createdAt: r.createdAt.toISOString() }));
  }

  /** Limpieza: registros de más de 90 días. */
  async purgeLogs(): Promise<number> {
    const r = await this.prisma.apiTokenLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } });
    return r.count;
  }
}

function toDto(r: { id: number; name: string; prefix: string; lastUsedAt: Date | null; createdAt: Date }): ApiTokenDto {
  return { id: r.id, name: r.name, prefix: r.prefix, lastUsedAt: r.lastUsedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() };
}
