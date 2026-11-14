import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY } from '../interfaces/notification.repository.interface';
import type { NotificationRepository } from '../interfaces/notification.repository.interface';
import { NotificationNotFoundException } from '../exceptions/notification.exceptions';
import type { NotificationEntity } from '../entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repository: NotificationRepository,
  ) {}

  async createOnce(
    input: Omit<NotificationEntity, 'id' | 'createdAt' | 'readAt'>,
  ): Promise<void> {
    await this.repository.createOnce(input);
  }

  async findPageForUser(userId: string, page: number, limit: number) {
    const result = await this.repository.findPageForUser(userId, page, limit);
    return {
      data: result.items,
      meta: { page, limit, total: result.total, unreadCount: result.unreadCount },
    };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.repository.markRead(userId, id);
    if (!notification) throw new NotificationNotFoundException(id);
    return notification;
  }

  markAllRead(userId: string): Promise<number> {
    return this.repository.markAllRead(userId);
  }
}
