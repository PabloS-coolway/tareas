import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../application/auth.service';
import { API_TOKEN_PREFIX, ApiTokenService } from '../../application/api-token.service';
import { IS_PUBLIC } from './decorators';

/** Guard global: exige un JWT válido o un token de API (`tk_…`), salvo en rutas marcadas @Public. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly apiTokens: ApiTokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Falta el token de acceso.');

    if (token.startsWith(API_TOKEN_PREFIX)) {
      const payload = await this.apiTokens.resolve(token);
      if (!payload) throw new UnauthorizedException('Token de API inválido o revocado.');
      req.user = payload;
      return true;
    }

    try {
      req.user = await this.jwt.verifyAsync<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o caducado.');
    }
  }
}
