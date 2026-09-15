import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CreateSavedViewDto, SavedViewDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, RequireFeature } from '../../../auth/interface/http/decorators';
import { ViewsService } from '../../application/views.service';

@Controller('views')
export class ViewsController {
  constructor(private readonly views: ViewsService) {}

  @Get()
  @RequireFeature('tareas.ver')
  list(@CurrentUser() me: JwtPayload, @Query('scope') scope?: string, @Query('projectId') projectId?: string): Promise<SavedViewDto[]> {
    return this.views.list(me.sub, scope === 'project' ? 'project' : 'global', projectId && /^\d+$/.test(projectId) ? Number(projectId) : null);
  }

  @Post()
  @RequireFeature('tareas.ver')
  create(@Body() body: CreateSavedViewDto, @CurrentUser() me: JwtPayload): Promise<SavedViewDto> {
    return this.views.create(body, me.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireFeature('tareas.ver')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() me: JwtPayload): Promise<void> {
    return this.views.remove(id, me.sub, me.role === 'admin');
  }
}
