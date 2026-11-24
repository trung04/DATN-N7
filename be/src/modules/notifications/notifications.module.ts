import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEmailDeliveryEntity } from './entities/notification-email-delivery.entity';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationEntity } from './entities/notification.entity';
import {
  NOTIFICATION_EMAIL_OUTBOX,
  NOTIFICATION_REPOSITORY,
} from './interfaces/notification.repository.interface';
import { NOTIFICATION_EMAIL_SENDER } from './interfaces/notification-email-sender.interface';
import { TypeOrmNotificationRepository } from './repositories/typeorm-notification.repository';
import { SmtpNotificationEmailSender } from './integrations/email/smtp-notification-email.sender';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      NotificationEmailDeliveryEntity,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    TypeOrmNotificationRepository,
    {
      provide: NOTIFICATION_REPOSITORY,
      useExisting: TypeOrmNotificationRepository,
    },
    {
      provide: NOTIFICATION_EMAIL_OUTBOX,
      useExisting: TypeOrmNotificationRepository,
    },
    SmtpNotificationEmailSender,
    {
      provide: NOTIFICATION_EMAIL_SENDER,
      useExisting: SmtpNotificationEmailSender,
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
