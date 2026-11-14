import type { NotificationEntity } from '../entities/notification.entity';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface NotificationPage {
  items: NotificationEntity[];
  total: number;
  unreadCount: number;
}

export interface NotificationRepository {
  createOnce(input: Omit<NotificationEntity, 'id' | 'createdAt' | 'readAt'>): Promise<void>;
  findPageForUser(userId: string, page: number, limit: number): Promise<NotificationPage>;
  markRead(userId: string, id: string): Promise<NotificationEntity | null>;
  markAllRead(userId: string): Promise<number>;
}
