import { Body, Controller, Headers, HttpCode, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../auth/interface/http/decorators';
import { GithubService } from '../../application/github.service';

/** Webhook de GitHub (push y pull_request). Público, pero sólo acepta peticiones firmadas con el secreto. */
@Controller('integrations/github')
@Public()
export class GithubController {
  constructor(private readonly github: GithubService) {}

  @Post()
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-github-event') evento: string, @Headers('x-hub-signature-256') firma: string, @Body() body: unknown) {
    this.github.verificar(req.rawBody, firma);
    if (evento === 'ping') return { ok: true };
    return this.github.recibir(evento, body as Parameters<GithubService['recibir']>[1]);
  }
}
