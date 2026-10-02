import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../application/auth.service';
import { API_TOKEN_PREFIX, ApiTokenService } from '../../application/api-token.service';
import { USER_REPOSITORY, UserRepository } from '../../application/ports';
import { sesionAlDia } from '../../domain/sesion';
import { IS_PUBLIC } from './decorators';

/**
 * Guard global: exige un JWT válido o un token de API (`tk_…`), salvo en rutas marcadas @Public.
 * Con JWT, el usuario se vuelve a leer de la base (TAREAS-20): el rol que vale es el de ahora y un
 * usuario desactivado se queda fuera, sin esperar a que caduque la sesión.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly apiTokens: ApiTokenService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
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
      // Registro de uso (salvo las llamadas por loopback del MCP remoto, que ya se apuntan como herramienta).
      if (req.headers['x-via'] !== 'mcp') {
        const t0 = Date.now();
        const res = ctx.switchToHttp().getResponse();
        res.once('finish', () => {
          const ruta = String(req.originalUrl ?? req.url ?? '').replace(/^\/api/, '');
          this.apiTokens.log({ tokenId: payload.tokenId, userId: payload.sub, source: 'api', action: `${req.method} ${ruta.split('?')[0].replace(/\/\d+/g, '/:id')}`, detail: ruta, ok: res.statusCode < 400, ms: Date.now() - t0 });
        });
      }
      return true;
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o caducado.');
    }
    const sesion = sesionAlDia(payload, await this.users.findById(payload.sub));
    if (!sesion) throw new UnauthorizedException('Tu usuario ya no tiene acceso. Vuelve a entrar.');
    req.user = sesion;
    return true;
  }
}
