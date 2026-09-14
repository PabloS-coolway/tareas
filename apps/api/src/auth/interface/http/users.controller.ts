import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateUserRequest, ResetPasswordRequest, UpdateUserRequest, UserDto, UserRefDto } from '@yorga/contracts';
import { PASSWORD_HASHER, PasswordHasher, USER_REPOSITORY, UserRepository } from '../../application/ports';
import { ROLE_REPOSITORY, RoleRepository } from '../../application/role.port';
import { toDto, JwtPayload } from '../../application/auth.service';
import { CurrentUser, RequireFeature } from './decorators';

/** Administración de usuarios: alta, cambio de rol, activar/desactivar y reset de contraseña. */
@Controller('users')
export class UsersController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  /** Directorio del equipo (para asignar tareas): lo ve cualquiera que vea tareas. Sólo activos, sin rol ni email sensible. */
  @Get('directorio')
  @RequireFeature('tareas.ver')
  async directorio(): Promise<UserRefDto[]> {
    return (await this.users.list()).filter((u) => u.active).map((u) => ({ id: u.id, name: u.name, email: u.email }));
  }

  @Get()
  @RequireFeature('usuarios.gestionar', 'usuarios.password')
  async list(): Promise<UserDto[]> {
    const roles = await this.roles.findAll();
    const featuresByKey = new Map(roles.map((r) => [r.key, r.features]));
    return (await this.users.list()).map((u) => toDto(u, featuresByKey.get(u.role) ?? []));
  }

  @Post()
  @RequireFeature('usuarios.gestionar')
  async create(@Body() body: CreateUserRequest): Promise<UserDto> {
    const email = body?.email?.trim().toLowerCase();
    if (!email || !body?.name || !body?.password) throw new BadRequestException('Indica email, nombre y contraseña.');
    if (body.password.length < 6) throw new BadRequestException('La contraseña debe tener al menos 6 caracteres.');
    if (await this.users.findByEmail(email)) throw new ConflictException('Ya existe un usuario con ese email.');

    const role = await this.roleOrFail(body.role);
    const passwordHash = await this.hasher.hash(body.password);
    const user = await this.users.create({ email, name: body.name.trim(), passwordHash, role: role.key });
    return toDto(user, role.features);
  }

  @Patch(':id')
  @RequireFeature('usuarios.gestionar')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateUserRequest, @CurrentUser() me: JwtPayload): Promise<UserDto> {
    const target = await this.users.findById(id);
    if (!target) throw new NotFoundException('Usuario no encontrado.');

    const data: { role?: string; active?: boolean } = {};
    if (body.role !== undefined && body.role !== target.role) {
      const nuevo = await this.roleOrFail(body.role);
      if (id === me.sub && !nuevo.features.includes('usuarios.gestionar')) {
        throw new ForbiddenException('No puedes quitarte a ti mismo el permiso de gestionar usuarios.');
      }
      data.role = nuevo.key;
    }
    if (typeof body.active === 'boolean') {
      if (id === me.sub && body.active === false) throw new ForbiddenException('No puedes desactivar tu propio usuario.');
      data.active = body.active;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('Nada que actualizar.');

    const updated = await this.users.update(id, data);
    return toDto(updated, await this.roles.featuresOf(updated.role));
  }

  /** Resetea la contraseña de OTRO usuario (feature propia, separada de la gestión de usuarios). */
  @Post(':id/reset-password')
  @RequireFeature('usuarios.password')
  @HttpCode(204)
  async resetPassword(@Param('id', ParseIntPipe) id: number, @Body() body: ResetPasswordRequest): Promise<void> {
    const target = await this.users.findById(id);
    if (!target) throw new NotFoundException('Usuario no encontrado.');
    if (!body?.password || body.password.length < 6) throw new BadRequestException('La contraseña debe tener al menos 6 caracteres.');
    await this.users.update(id, { passwordHash: await this.hasher.hash(body.password) });
  }

  private async roleOrFail(key: string | undefined) {
    const role = key ? await this.roles.findByKey(key) : null;
    if (!role) throw new BadRequestException(`Rol desconocido: "${key ?? ''}".`);
    return role;
  }
}
