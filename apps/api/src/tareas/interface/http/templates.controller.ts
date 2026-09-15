import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CreateTaskTemplateDto, InstantiateTemplateDto, TaskDto, TaskTemplateDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, RequireFeature } from '../../../auth/interface/http/decorators';
import { TemplatesService } from '../../application/templates.service';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  @RequireFeature('tareas.ver')
  list(@Query('projectId') projectId?: string): Promise<TaskTemplateDto[]> {
    return this.templates.list(projectId && /^\d+$/.test(projectId) ? Number(projectId) : undefined);
  }

  @Post()
  @RequireFeature('tareas.editar')
  create(@Body() body: CreateTaskTemplateDto): Promise<TaskTemplateDto> {
    return this.templates.create(body);
  }

  @Post('from-task/:taskId')
  @RequireFeature('tareas.editar')
  fromTask(@Param('taskId', ParseIntPipe) taskId: number, @Body() body: { name: string; global?: boolean }): Promise<TaskTemplateDto> {
    return this.templates.fromTask(taskId, body?.name?.trim() ?? '', !!body?.global);
  }

  @Post(':id/instantiate')
  @RequireFeature('tareas.editar')
  instantiate(@Param('id', ParseIntPipe) id: number, @Body() body: InstantiateTemplateDto, @CurrentUser() me: JwtPayload): Promise<TaskDto> {
    return this.templates.instantiate(id, body, me.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireFeature('tareas.editar')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.templates.remove(id);
  }
}
