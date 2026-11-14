import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationEntity } from './entities/notification.entity';
import { NOTIFICATION_REPOSITORY } from './interfaces/notification.repository.interface';
import { TypeOrmNotificationRepository } from './repositories/typeorm-notification.repository';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity])],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: NOTIFICATION_REPOSITORY, useClass: TypeOrmNotificationRepository },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
