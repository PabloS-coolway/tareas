import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Feature } from '@yorga/contracts';
import { JwtPayload } from '../../application/auth.service';
import { ROLE_REPOSITORY, RoleRepository } from '../../application/role.port';
import { FEATURES_KEY } from './decorators';

/**
 * REQ-006 · Guard global por FEATURE. Si la ruta declara `@RequireFeature`, mira qué features tiene el ROL
 * del usuario **leyéndolas de la BD** (no del JWT): así un cambio de permisos aplica sin re-login. Basta con
 * tener una de las features declaradas.
 *
 * Sólo consulta la BD en rutas que declaran features (las sensibles): las abiertas no pagan ese coste.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Feature[]>(FEATURES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true; // sin @RequireFeature → basta con estar autenticado

    const user = ctx.switchToHttp().getRequest().user as JwtPayload | undefined;
    if (!user) throw new ForbiddenException('No tienes permisos para esta acción.');

    const features = await this.roles.featuresOf(user.role);
    if (!required.some((f) => features.includes(f))) {
      throw new ForbiddenException('No tienes permisos para esta acción.');
    }
    return true;
  }
}
