import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NotificationEntity } from '../entities/notification.entity';
import { NotificationEmailDeliveryEntity } from '../entities/notification-email-delivery.entity';
import { NotificationEmailDeliveryStatus } from '../entities/notification.entity';
import type {
  NotificationEmailDeliveryJob,
  NotificationEmailOutboxRepository,
  NotificationPage,
  NotificationRepository,
} from '../interfaces/notification.repository.interface';

@Injectable()
export class TypeOrmNotificationRepository
  implements NotificationRepository, NotificationEmailOutboxRepository
{
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repository: Repository<NotificationEntity>,
  ) {}

  async createOnce(
    input: Omit<NotificationEntity, 'id' | 'createdAt' | 'readAt'>,
    emailRecipient?: string,
  ): Promise<boolean> {
    return this.repository.manager.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(NotificationEntity)
        .values(input)
        .orIgnore()
        .returning(['id'])
        .execute();
      const notificationId = result.raw?.[0]?.id as string | undefined;
      if (!notificationId) return false;

      if (emailRecipient) {
        await manager.getRepository(NotificationEmailDeliveryEntity).insert({
          notificationId,
          recipientEmail: emailRecipient,
          status: NotificationEmailDeliveryStatus.PENDING,
          attemptCount: 0,
          availableAt: new Date(),
          claimedAt: null,
          sentAt: null,
          lastError: null,
        });
      }
      return true;
    });
  }

  async claimEmailDeliveries(
    limit: number,
  ): Promise<NotificationEmailDeliveryJob[]> {
    const rows = await this.repository.manager.query(
      [
        'WITH due AS (',
        'SELECT id FROM notification_email_deliveries',
        'WHERE (status = $1 AND available_at <= now())',
        'OR (status = $2 AND claimed_at < now() - interval \'10 minutes\')',
        'ORDER BY available_at ASC, created_at ASC',
        'FOR UPDATE SKIP LOCKED LIMIT $3',
        '), claimed AS (',
        'UPDATE notification_email_deliveries AS delivery',
        'SET status = $2, attempt_count = delivery.attempt_count + 1,',
        'claimed_at = now(), updated_at = now()',
        'FROM due WHERE delivery.id = due.id',
        'RETURNING delivery.id, delivery.notification_id, delivery.recipient_email, delivery.attempt_count',
        ')',
        'SELECT claimed.id, claimed.recipient_email AS "recipientEmail",',
        'notification.title, notification.message, notification.link,',
        'claimed.attempt_count AS "attemptCount"',
        'FROM claimed JOIN notifications AS notification',
        'ON notification.id = claimed.notification_id',
      ].join(' '),
      [
        NotificationEmailDeliveryStatus.PENDING,
        NotificationEmailDeliveryStatus.PROCESSING,
        limit,
      ],
    );
    return rows as NotificationEmailDeliveryJob[];
  }

  async markEmailDeliverySent(id: string): Promise<void> {
    await this.repository.manager.query(
      [
        'UPDATE notification_email_deliveries',
        'SET status = $2, sent_at = now(), claimed_at = NULL,',
        'last_error = NULL, updated_at = now()',
        'WHERE id = $1 AND status = $3',
      ].join(' '),
      [
        id,
        NotificationEmailDeliveryStatus.SENT,
        NotificationEmailDeliveryStatus.PROCESSING,
      ],
    );
  }

  async failEmailDelivery(
    id: string,
    retryAt: Date | null,
    reason: string,
  ): Promise<void> {
    await this.repository.manager.query(
      [
        'UPDATE notification_email_deliveries',
        'SET status = CASE WHEN $2::timestamptz IS NULL THEN $4 ELSE $5 END,',
        'available_at = COALESCE($2::timestamptz, available_at),',
        'claimed_at = NULL, last_error = $3, updated_at = now()',
        'WHERE id = $1 AND status = $6',
      ].join(' '),
      [
        id,
        retryAt,
        reason.slice(0, 500),
        NotificationEmailDeliveryStatus.FAILED,
        NotificationEmailDeliveryStatus.PENDING,
        NotificationEmailDeliveryStatus.PROCESSING,
      ],
    );
  }

  async findPageForUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<NotificationPage> {
    const [items, total, unreadCount] = await Promise.all([
      this.repository.find({
        where: { userId },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.repository.count({ where: { userId } }),
      this.repository.count({ where: { userId, readAt: IsNull() } }),
    ]);
    return { items, total, unreadCount };
  }

  async markRead(userId: string, id: string): Promise<NotificationEntity | null> {
    await this.repository.update(
      { id, userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return this.repository.findOne({ where: { id, userId } });
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.repository.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return result.affected ?? 0;
  }
}
