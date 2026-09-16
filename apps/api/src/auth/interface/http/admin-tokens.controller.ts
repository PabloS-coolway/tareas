import { Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Query } from '@nestjs/common';
import { AdminTokenDto, TokenLogDto } from '@yorga/contracts';
import { ApiTokenService } from '../../application/api-token.service';
import { RequireFeature } from './decorators';

/** Administración de integraciones: tokens de todo el equipo, quién está conectado y registro de llamadas. */
@Controller('admin/tokens')
export class AdminTokensController {
  constructor(private readonly tokens: ApiTokenService) {}

  @Get()
  @RequireFeature('usuarios.gestionar')
  list(): Promise<AdminTokenDto[]> {
    return this.tokens.listAll();
  }

  @Get('logs')
  @RequireFeature('usuarios.gestionar')
  logs(@Query('userId') userId?: string, @Query('tokenId') tokenId?: string, @Query('limit') limit?: string, @Query('before') before?: string): Promise<TokenLogDto[]> {
    const num = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
    return this.tokens.logs({ userId: num(userId), tokenId: num(tokenId), limit: num(limit), before: num(before) });
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireFeature('usuarios.gestionar')
  revoke(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tokens.revokeAny(id);
  }
}
