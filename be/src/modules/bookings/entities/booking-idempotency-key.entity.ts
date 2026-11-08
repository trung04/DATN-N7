import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { BookingEntity } from './booking.entity';

@Entity({ name: 'booking_idempotency_keys' })
@Index('IDX_booking_idempotency_keys_expires_at', ['expiresAt'])
@Index('UQ_booking_idempotency_keys_booking_id', ['bookingId'], {
  unique: true,
})
export class BookingIdempotencyKeyEntity {
  @PrimaryColumn({ name: 'idempotency_key', type: 'uuid' })
  idempotencyKey: string;

  @Column({ name: 'request_hash', type: 'char', length: 64 })
  requestHash: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @ManyToOne(() => BookingEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: BookingEntity;
}
