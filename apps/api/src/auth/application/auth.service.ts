import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../infrastructure/db/prisma.service';
import { correoConfigurado, enviarCorreo } from '../infrastructure/mailer';
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
    private readonly prisma: PrismaService,
  ) {}

  /** Valida credenciales y emite un token. Mensaje genérico: no revela si el email existe. */
  async login(email: string, password: string, remember = false): Promise<LoginResponse> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    const ok = user && user.active && (await this.hasher.compare(password, user.passwordHash));
    if (!user || !ok) throw new UnauthorizedException('Email o contraseña incorrectos.');

    const payload: JwtPayload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    // "Recordarme": 30 días en vez de la caducidad normal (JWT_EXPIRES_IN, 12 h).
    const token = remember ? await this.jwt.signAsync(payload, { expiresIn: '30d' }) : await this.jwt.signAsync(payload);
    return { token, user: toDto(user, await this.roles.featuresOf(user.role)) };
  }

  /**
   * "He olvidado mi contraseña". Nunca revela si el email existe. Si hay correo configurado, manda un enlace
   * (1 h, un solo uso); si no, avisa a los administradores en la app para que le pongan una temporal.
   */
  async forgotPassword(email: string, baseUrl: string): Promise<void> {
    const user = await this.users.findByEmail(String(email ?? '').trim().toLowerCase());
    if (!user || !user.active) return;
    const admins = (await this.users.list()).filter((u) => u.active && u.role === 'admin' && u.id !== user.id);
    if (correoConfigurado()) {
      const token = randomBytes(32).toString('base64url');
      await this.prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60_000) } });
      const link = `${baseUrl.replace(/\/$/, '')}/restablecer?token=${token}`;
      const enviado = await enviarCorreo(
        user.email,
        'Restablecer tu contraseña · Tareas Yorga',
        `Hola ${user.name},\n\nPara poner una contraseña nueva entra aquí (caduca en 1 hora):\n${link}\n\nSi no lo has pedido tú, ignora este correo.`,
        `<p>Hola ${user.name},</p><p>Para poner una contraseña nueva entra aquí (caduca en 1 hora):</p><p><a href="${link}">${link}</a></p><p>Si no lo has pedido tú, ignora este correo.</p>`,
      ).catch(() => false);
      if (enviado) return;
    }
    // Sin correo: aviso a los administradores.
    if (admins.length) {
      await this.prisma.notification.createMany({
        data: admins.map((a) => ({ userId: a.id, type: 'PASSWORD_RESET', actorId: user.id, text: `pidió restablecer su contraseña (${user.email}). Ponle una temporal en Usuarios y envíasela.` })),
      });
    }
  }

  /** Nueva contraseña con el token del enlace. */
  async resetPassword(token: string, nueva: string): Promise<void> {
    const limpia = String(nueva ?? '');
    if (limpia.length < 6) throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres.');
    const pr = await this.prisma.passwordReset.findUnique({ where: { tokenHash: sha256(String(token ?? '')) } });
    if (!pr || pr.usedAt || pr.expiresAt < new Date()) throw new BadRequestException('El enlace no es válido o ha caducado. Pide uno nuevo.');
    await this.prisma.$transaction(async (tx) => {
      await this.users.update(pr.userId, { passwordHash: await this.hasher.hash(limpia) }, tx);
      await tx.passwordReset.update({ where: { id: pr.id }, data: { usedAt: new Date() } });
    });
  }

  /** ¿Hay correo saliente configurado? (la pantalla de "olvidé" adapta el mensaje). */
  correoDisponible(): boolean {
    return correoConfigurado();
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

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
