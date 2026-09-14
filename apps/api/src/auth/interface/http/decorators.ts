import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Feature } from '@yorga/contracts';
import { JwtPayload } from '../../application/auth.service';

/** Marca una ruta como pública (sin JWT). */
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * REQ-006 · Restringe una ruta a quien tenga la feature (implica autenticación). Sustituye a `@Roles`:
 * el permiso ya no se ata a un nombre de rol, sino a una FEATURE del catálogo cerrado. Si se declaran
 * varias, basta con tener **una** de ellas.
 */
export const FEATURES_KEY = 'features';
export const RequireFeature = (...features: Feature[]) => SetMetadata(FEATURES_KEY, features);

/** Inyecta el usuario autenticado (payload del JWT) en el handler. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtPayload => {
  return ctx.switchToHttp().getRequest().user;
});
