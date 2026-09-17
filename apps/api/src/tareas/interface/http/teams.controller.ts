import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CreateTeamDto, TeamDto, UpdateTeamDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, RequireFeature } from '../../../auth/interface/http/decorators';
import { TeamsService } from '../../application/teams.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  /** Todos los equipos (nombres y colores los necesita cualquiera para pintar chips); `mine` dice a cuáles pertenece. */
  @Get()
  @RequireFeature('tareas.ver')
  list(@CurrentUser() me: JwtPayload): Promise<TeamDto[]> {
    return this.teams.list(me.sub);
  }

  @Post()
  @RequireFeature('equipos.gestionar')
  create(@Body() body: CreateTeamDto, @CurrentUser() me: JwtPayload): Promise<TeamDto> {
    return this.teams.create(body, me.sub);
  }

  @Patch(':id')
  @RequireFeature('equipos.gestionar')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateTeamDto, @CurrentUser() me: JwtPayload): Promise<TeamDto> {
    return this.teams.update(id, body, me.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireFeature('equipos.gestionar')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.teams.remove(id);
  }
}
