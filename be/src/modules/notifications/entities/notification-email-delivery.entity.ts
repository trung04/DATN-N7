import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationEmailDeliveryStatus } from './notification.entity';

@Entity({ name: 'notification_email_deliveries' })
@Index('UQ_notification_email_deliveries_notification', ['notificationId'], {
  unique: true,
})
@Index('IDX_notification_email_deliveries_due', ['status', 'availableAt'])
export class NotificationEmailDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId: string;

  @Column({ name: 'recipient_email', type: 'varchar', length: 320 })
  recipientEmail: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: NotificationEmailDeliveryStatus.PENDING,
  })
  status: NotificationEmailDeliveryStatus;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount: number;

  @Column({ name: 'available_at', type: 'timestamptz', default: () => 'now()' })
  availableAt: Date;

  @Column({ name: 'claimed_at', type: 'timestamptz', nullable: true })
  claimedAt: Date | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
