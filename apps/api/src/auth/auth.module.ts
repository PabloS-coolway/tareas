import { Module, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../infrastructure/db/prisma.service';
import { AuthService } from './application/auth.service';
import { ApiTokenService } from './application/api-token.service';
import { PASSWORD_HASHER, USER_REPOSITORY } from './application/ports';
import { ROLE_REPOSITORY } from './application/role.port';
import { RolesService } from './application/roles.service';
import { BcryptHasher } from './infrastructure/bcrypt-hasher';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { PrismaRoleRepository } from './infrastructure/prisma-role.repository';
import { AuthController } from './interface/http/auth.controller';
import { UsersController } from './interface/http/users.controller';
import { RolesController } from './interface/http/roles.controller';
import { TokensController } from './interface/http/tokens.controller';
import { AdminTokensController } from './interface/http/admin-tokens.controller';
import { JwtAuthGuard } from './interface/http/jwt-auth.guard';
import { FeatureGuard } from './interface/http/feature.guard';
import { jwtOptions } from './auth.config';

/** Proveedores del hexágono de auth. */
export const authProviders: Provider[] = [
  PrismaService,
  AuthService,
  RolesService,
  ApiTokenService,
  { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  { provide: ROLE_REPOSITORY, useClass: PrismaRoleRepository },
  { provide: PASSWORD_HASHER, useClass: BcryptHasher },
];

/** Módulo de autenticación: login/me, usuarios, roles, tokens de API + guards globales (JWT|token + feature). */
@Module({
  imports: [JwtModule.register(jwtOptions())],
  controllers: [AuthController, UsersController, RolesController, TokensController, AdminTokensController],
  providers: [
    ...authProviders,
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // 1º: exige JWT o token de API
    { provide: APP_GUARD, useClass: FeatureGuard }, // 2º: comprueba la feature del rol
  ],
  exports: [AuthService, USER_REPOSITORY, ROLE_REPOSITORY, PASSWORD_HASHER, JwtModule, PrismaService],
})
export class AuthModule {}
