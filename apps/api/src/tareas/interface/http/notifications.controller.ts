import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { NotificationsPageDto } from '@yorga/contracts';
import { JwtPayload } from '../../../auth/application/auth.service';
import { CurrentUser, RequireFeature } from '../../../auth/interface/http/decorators';
import { NotificationsService } from '../../application/notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequireFeature('tareas.ver')
  list(@CurrentUser() me: JwtPayload, @Query('limit') limit?: string): Promise<NotificationsPageDto> {
    return this.notifications.listMine(me.sub, limit && /^\d+$/.test(limit) ? Number(limit) : 50);
  }

  @Get('unread')
  @RequireFeature('tareas.ver')
  async unread(@CurrentUser() me: JwtPayload): Promise<{ unread: number }> {
    return { unread: await this.notifications.unreadCount(me.sub) };
  }

  @Post('read')
  @HttpCode(204)
  @RequireFeature('tareas.ver')
  readAll(@CurrentUser() me: JwtPayload): Promise<void> {
    return this.notifications.markRead(me.sub);
  }

  @Post(':id/read')
  @HttpCode(204)
  @RequireFeature('tareas.ver')
  readOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() me: JwtPayload): Promise<void> {
    return this.notifications.markRead(me.sub, id);
  }
}
