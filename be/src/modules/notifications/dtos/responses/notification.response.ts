import type { NotificationEntity } from '../../entities/notification.entity';

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPageResponse {
  data: NotificationResponse[];
  meta: { page: number; limit: number; total: number; unreadCount: number };
}

export class NotificationMapper {
  static toResponse(entity: NotificationEntity): NotificationResponse {
    return {
      id: entity.id,
      type: entity.type,
      title: entity.title,
      message: entity.message,
      link: entity.link,
      readAt: entity.readAt?.toISOString() ?? null,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
