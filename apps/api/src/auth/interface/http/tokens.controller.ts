import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTokenDto, CreatedApiTokenDto } from '@yorga/contracts';
import { ApiTokenService } from '../../application/api-token.service';
import { JwtPayload } from '../../application/auth.service';
import { CurrentUser } from './decorators';

/** Tokens de API del propio usuario. Cualquiera autenticado gestiona los suyos. */
@Controller('tokens')
export class TokensController {
  constructor(private readonly tokens: ApiTokenService) {}

  @Get()
  list(@CurrentUser() me: JwtPayload): Promise<ApiTokenDto[]> {
    return this.tokens.listMine(me.sub);
  }

  @Post()
  create(@Body() body: { name?: string }, @CurrentUser() me: JwtPayload): Promise<CreatedApiTokenDto> {
    return this.tokens.create(me.sub, body?.name ?? '');
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(@Param('id', ParseIntPipe) id: number, @CurrentUser() me: JwtPayload): Promise<void> {
    await this.tokens.revoke(me.sub, id);
  }
}
