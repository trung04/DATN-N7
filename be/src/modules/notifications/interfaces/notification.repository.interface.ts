import type { NotificationEntity } from '../entities/notification.entity';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface NotificationPage {
  items: NotificationEntity[];
  total: number;
  unreadCount: number;
}

export interface NotificationEmailDeliveryJob {
  id: string;
  recipientEmail: string;
  title: string;
  message: string;
  link: string;
  attemptCount: number;
}

export interface NotificationRepository {
  createOnce(
    input: Omit<NotificationEntity, 'id' | 'createdAt' | 'readAt'>,
    emailRecipient?: string,
  ): Promise<boolean>;
  findPageForUser(userId: string, page: number, limit: number): Promise<NotificationPage>;
  markRead(userId: string, id: string): Promise<NotificationEntity | null>;
  markAllRead(userId: string): Promise<number>;
}

export const NOTIFICATION_EMAIL_OUTBOX = Symbol('NOTIFICATION_EMAIL_OUTBOX');

export interface NotificationEmailOutboxRepository {
  claimEmailDeliveries(limit: number): Promise<NotificationEmailDeliveryJob[]>;
  markEmailDeliverySent(id: string): Promise<void>;
  failEmailDelivery(
    id: string,
    retryAt: Date | null,
    reason: string,
  ): Promise<void>;
}
