import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { NotificationsPageDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, RequireFeature } from '../../../auth/interface/http/decorators';
import { NotificationsService } from '../../application/notifications.service';
import { limpiarIdsAvisos } from '../../domain/avisos';
import { normalizarClaveProyecto } from '../../domain/clave';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequireFeature('tareas.ver')
  list(@CurrentUser() me: JwtPayload, @Query('limit') limit?: string, @Query('proyecto') proyecto?: string, @Query('sinLeer') sinLeer?: string): Promise<NotificationsPageDto> {
    return this.notifications.listMine(me.sub, limit && /^\d+$/.test(limit) ? Number(limit) : 50, {
      proyecto: proyecto ? normalizarClaveProyecto(proyecto) : undefined,
      soloSinLeer: sinLeer === '1' || sinLeer === 'true',
    });
  }

  @Get('unread')
  @RequireFeature('tareas.ver')
  async unread(@CurrentUser() me: JwtPayload): Promise<{ unread: number; porProyecto: Record<string, number> }> {
    const [unread, porProyecto] = await Promise.all([this.notifications.unreadCount(me.sub), this.notifications.unreadPorProyecto(me.sub)]);
    return { unread, porProyecto };
  }

  /** Sin cuerpo: todos leídos. Con `{ ids }`: solo esos (los que se acaban de enseñar). */
  @Post('read')
  @HttpCode(204)
  @RequireFeature('tareas.ver')
  readAll(@CurrentUser() me: JwtPayload, @Body() body?: { ids?: unknown }): Promise<void> {
    if (body && body.ids !== undefined) return this.notifications.markReadIds(me.sub, limpiarIdsAvisos(body.ids));
    return this.notifications.markRead(me.sub);
  }

  @Post(':id/read')
  @HttpCode(204)
  @RequireFeature('tareas.ver')
  readOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() me: JwtPayload): Promise<void> {
    return this.notifications.markRead(me.sub, id);
  }

  @Delete()
  @HttpCode(204)
  @RequireFeature('tareas.ver')
  removeAll(@CurrentUser() me: JwtPayload): Promise<void> {
    return this.notifications.remove(me.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireFeature('tareas.ver')
  removeOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() me: JwtPayload): Promise<void> {
    return this.notifications.remove(me.sub, id);
  }
}
