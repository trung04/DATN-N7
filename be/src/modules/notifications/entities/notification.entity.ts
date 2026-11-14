import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum NotificationType {
  PAYMENT_SUCCEEDED = 'PAYMENT_SUCCEEDED',
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  REFUND_PROCESSING = 'REFUND_PROCESSING',
  REFUND_SUCCEEDED = 'REFUND_SUCCEEDED',
  REFUND_FAILED = 'REFUND_FAILED',
}

@Entity({ name: 'notifications' })
@Index('UQ_notifications_event_key', ['eventKey'], { unique: true })
@Index('IDX_notifications_user_created', ['userId', 'createdAt'])
@Index('IDX_notifications_user_unread', ['userId', 'createdAt'], {
  where: '"read_at" IS NULL',
})
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 40 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 255 })
  link: string;

  @Column({ name: 'event_key', type: 'varchar', length: 180 })
  eventKey: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
