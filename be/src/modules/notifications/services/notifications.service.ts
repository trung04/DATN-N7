import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import {
  NOTIFICATION_EMAIL_OUTBOX,
  NOTIFICATION_REPOSITORY,
} from '../interfaces/notification.repository.interface';
import type {
  NotificationEmailOutboxRepository,
  NotificationRepository,
} from '../interfaces/notification.repository.interface';
import { NOTIFICATION_EMAIL_SENDER } from '../interfaces/notification-email-sender.interface';
import type { NotificationEmailSender } from '../interfaces/notification-email-sender.interface';
import { NotificationNotFoundException } from '../exceptions/notification.exceptions';
import type { NotificationEntity } from '../entities/notification.entity';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private emailPoller: ReturnType<typeof setInterval> | undefined;
  private dispatching = false;
  private warnedAboutSmtp = false;

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repository: NotificationRepository,
    @Optional()
    @Inject(NOTIFICATION_EMAIL_SENDER)
    private readonly emailSender?: NotificationEmailSender,
    @Optional()
    @Inject(NOTIFICATION_EMAIL_OUTBOX)
    private readonly emailOutbox?: NotificationEmailOutboxRepository,
  ) {}

  onModuleInit(): void {
    if (!this.emailSender?.isConfigured()) {
      this.logger.warn('SMTP is not configured; booking emails are disabled.');
      return;
    }
    this.emailPoller = setInterval(() => {
      void this.dispatchPendingEmails();
    }, 5000);
    this.emailPoller.unref?.();
    void this.dispatchPendingEmails();
  }

  onModuleDestroy(): void {
    if (this.emailPoller) clearInterval(this.emailPoller);
  }

  async createOnce(
    input: Omit<NotificationEntity, 'id' | 'createdAt' | 'readAt'>,
    emailRecipient?: string,
  ): Promise<void> {
    const canSendEmail = Boolean(
      emailRecipient && this.emailSender?.isConfigured(),
    );
    if (emailRecipient && !canSendEmail && !this.warnedAboutSmtp) {
      this.warnedAboutSmtp = true;
      this.logger.warn('SMTP is not configured; this booking update will be in-app only.');
    }
    const inserted = canSendEmail
      ? await this.repository.createOnce(
          input,
          emailRecipient?.trim().toLowerCase(),
        )
      : await this.repository.createOnce(input);
    if (inserted && canSendEmail) void this.dispatchPendingEmails();
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

  private async dispatchPendingEmails(): Promise<void> {
    if (
      this.dispatching ||
      !this.emailSender?.isConfigured() ||
      !this.emailOutbox
    ) {
      return;
    }
    this.dispatching = true;
    try {
      const jobs = await this.emailOutbox.claimEmailDeliveries(10);
      await Promise.all(
        jobs.map(async (job) => {
          try {
            await this.emailSender!.send({
              recipientEmail: job.recipientEmail,
              title: job.title,
              message: job.message,
              link: job.link,
            });
            await this.emailOutbox!.markEmailDeliverySent(job.id);
          } catch {
            const retryAt =
              job.attemptCount >= 5
                ? null
                : new Date(
                    Date.now() +
                      Math.min(
                        30_000 * 2 ** Math.max(job.attemptCount - 1, 0),
                        1_800_000,
                      ),
                  );
            try {
              await this.emailOutbox!.failEmailDelivery(
                job.id,
                retryAt,
                'SMTP delivery failed.',
              );
            } catch {
              this.logger.error(
                'Could not update booking email delivery state.',
              );
            }
            this.logger.warn(
              'Booking email delivery failed for an outbox item.',
            );
          }
        }),
      );
    } catch {
      this.logger.error('Could not process booking email outbox.');
    } finally {
      this.dispatching = false;
    }
  }
}
