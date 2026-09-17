import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { BurndownDto, CloseSprintDto, CreateSprintDto, SprintDto, UpdateSprintDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, RequireFeature } from '../../../auth/interface/http/decorators';
import { SprintsService } from '../../application/sprints.service';

@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get()
  @RequireFeature('tareas.ver')
  /** `projectId`: sólo los que admiten tareas de ese proyecto (transversales + los suyos). */
  list(@Query('closed') closed?: string, @Query('projectId') projectId?: string): Promise<SprintDto[]> {
    return this.sprints.list(closed === 'true', projectId && /^\d+$/.test(projectId) ? Number(projectId) : undefined);
  }

  @Get(':id')
  @RequireFeature('tareas.ver')
  get(@Param('id', ParseIntPipe) id: number): Promise<SprintDto> {
    return this.sprints.get(id);
  }

  @Get(':id/burndown')
  @RequireFeature('tareas.ver')
  burndown(@Param('id', ParseIntPipe) id: number): Promise<BurndownDto> {
    return this.sprints.burndown(id);
  }

  @Post()
  @RequireFeature('tareas.editar')
  create(@Body() body: CreateSprintDto): Promise<SprintDto> {
    return this.sprints.create(body);
  }

  @Patch(':id')
  @RequireFeature('tareas.editar')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSprintDto): Promise<SprintDto> {
    return this.sprints.update(id, body);
  }

  @Post(':id/close')
  @RequireFeature('tareas.editar')
  close(@Param('id', ParseIntPipe) id: number, @Body() body: CloseSprintDto, @CurrentUser() me: JwtPayload): Promise<SprintDto> {
    return this.sprints.close(id, body ?? {}, me.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireFeature('tareas.editar')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.sprints.remove(id);
  }
}
