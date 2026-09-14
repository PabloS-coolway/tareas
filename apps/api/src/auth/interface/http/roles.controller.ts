import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CreateRoleDto, RoleDto, UpdateRoleDto } from '@yorga/contracts';
import { RolesService } from '../../application/roles.service';
import { InvalidRoleError } from '../../domain/role';
import { RequireFeature } from './decorators';

/**
 * Administración de roles. Requiere `roles.gestionar` — es la meta-feature: quien la tiene puede repartir
 * cualquier permiso, así que se protege con ella misma. No hay DELETE: los roles se **desactivan** (para no
 * romper los usuarios que los tuvieran); los de sistema, además, no se tocan como clave.
 */
@RequireFeature('roles.gestionar')
@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  // Listar roles lo necesita también quien gestiona USUARIOS (para el desplegable de "rol" al dar de alta),
  // no sólo quien gestiona roles. Sobrescribe la feature del controlador para esta ruta de lectura.
  @RequireFeature('roles.gestionar', 'usuarios.gestionar')
  @Get()
  list(): Promise<RoleDto[]> {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateRoleDto): Promise<RoleDto> {
    return this.service.create(dto).catch(traducir);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto): Promise<RoleDto> {
    return this.service.update(id, dto).catch(traducir);
  }
}

/** Un dato inválido o un cambio prohibido (anti-bloqueo) es culpa de quien lo manda (400), no un 500. */
function traducir(e: unknown): never {
  if (e instanceof InvalidRoleError) throw new BadRequestException(e.message);
  throw e;
}
