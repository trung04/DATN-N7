import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import { ListNotificationsRequest } from '../dtos/requests/list-notifications.request';
import { NotificationMapper } from '../dtos/responses/notification.response';
import { NotificationsService } from '../services/notifications.service';

@ApiTags('Notifications')
@Roles(UserRole.TOURIST)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: UserEntity,
    @Query() query: ListNotificationsRequest,
  ) {
    const page = await this.notificationsService.findPageForUser(
      user.id,
      query.page,
      query.limit,
    );
    return {
      ...page,
      data: page.data.map(NotificationMapper.toResponse),
    };
  }

  @Patch('read-all')
  @HttpCode(200)
  async markAllRead(@CurrentUser() user: UserEntity): Promise<{ updated: number }> {
    return { updated: await this.notificationsService.markAllRead(user.id) };
  }

  @Patch(':notificationId/read')
  async markRead(
    @CurrentUser() user: UserEntity,
    @Param('notificationId', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return NotificationMapper.toResponse(
      await this.notificationsService.markRead(user.id, id),
    );
  }
}
