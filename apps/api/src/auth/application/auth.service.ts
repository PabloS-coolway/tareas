import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Feature, LoginResponse, UserDto } from '@yorga/contracts';
import { User } from '../domain/user';
import { PASSWORD_HASHER, PasswordHasher, USER_REPOSITORY, UserRepository } from './ports';
import { ROLE_REPOSITORY, RoleRepository } from './role.port';

/** Contenido del JWT que viaja en cada petición. Lleva la CLAVE del rol; las features se leen de la BD. */
export interface JwtPayload {
  sub: number;
  email: string;
  name: string;
  role: User['role'];
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    private readonly jwt: JwtService,
  ) {}

  /** Valida credenciales y emite un token. Mensaje genérico: no revela si el email existe. */
  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    const ok = user && user.active && (await this.hasher.compare(password, user.passwordHash));
    if (!user || !ok) throw new UnauthorizedException('Email o contraseña incorrectos.');

    const payload: JwtPayload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    const token = await this.jwt.signAsync(payload);
    return { token, user: toDto(user, await this.roles.featuresOf(user.role)) };
  }

  /** Devuelve el usuario del payload (para GET /auth/me), verificando que siga activo. */
  async me(userId: number): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user || !user.active) throw new UnauthorizedException('Sesión no válida.');
    return toDto(user, await this.roles.featuresOf(user.role));
  }

  /**
   * MEJ · El propio usuario cambia su contraseña (tras entrar con la temporal que le puso el admin). Exige la
   * contraseña **actual** (verificación real, no basta con estar logueado) y que la nueva sea distinta.
   */
  async changePassword(userId: number, actual: string, nueva: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || !user.active) throw new UnauthorizedException('Sesión no válida.');
    if (!(await this.hasher.compare(String(actual ?? ''), user.passwordHash))) {
      throw new BadRequestException('La contraseña actual no es correcta.');
    }
    const limpia = String(nueva ?? '');
    if (limpia.length < 6) throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres.');
    if (await this.hasher.compare(limpia, user.passwordHash)) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual.');
    }
    await this.users.update(userId, { passwordHash: await this.hasher.hash(limpia) });
  }
}

export function toDto(u: User, features: Feature[]): UserDto {
  return { id: u.id, email: u.email, name: u.name, role: u.role, features, active: u.active };
}
