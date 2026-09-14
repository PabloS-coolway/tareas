import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { CreateProjectDto, ProjectDto, UpdateProjectDto, UpsertStatusDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, RequireFeature } from '../../../auth/interface/http/decorators';
import { ProjectsService } from '../../application/projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequireFeature('tareas.ver')
  list(@CurrentUser() me: JwtPayload, @Query('archived') archived?: string): Promise<ProjectDto[]> {
    return this.projects.list(me.sub, archived === 'true');
  }

  @Get(':idOrKey')
  @RequireFeature('tareas.ver')
  get(@Param('idOrKey') idOrKey: string, @CurrentUser() me: JwtPayload): Promise<ProjectDto> {
    return this.projects.get(idOrKey, me.sub);
  }

  @Post()
  @RequireFeature('proyectos.gestionar')
  create(@Body() body: CreateProjectDto, @CurrentUser() me: JwtPayload): Promise<ProjectDto> {
    return this.projects.create(body, me.sub);
  }

  @Patch(':id')
  @RequireFeature('proyectos.gestionar')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateProjectDto, @CurrentUser() me: JwtPayload): Promise<ProjectDto> {
    return this.projects.update(id, body, me.sub);
  }

  @Put(':id/statuses')
  @RequireFeature('proyectos.gestionar')
  statuses(@Param('id', ParseIntPipe) id: number, @Body() body: UpsertStatusDto[], @CurrentUser() me: JwtPayload): Promise<ProjectDto> {
    return this.projects.replaceStatuses(id, body, me.sub);
  }
}
