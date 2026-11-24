import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BookingEntity } from '../../bookings/entities/booking.entity';
import { HotelEntity } from '../../hotels/entities/hotel.entity';
import { UserEntity } from '../../users/entities/user.entity';

export enum ReviewStatus {
  PENDING = 'PENDING',
  VISIBLE = 'VISIBLE',
  HIDDEN = 'HIDDEN',
}

@Entity({ name: 'reviews' })
@Index('UQ_reviews_booking_id', ['bookingId'], { unique: true })
@Index('IDX_reviews_hotel_status_created', ['hotelId', 'status', 'createdAt'])
@Index('IDX_reviews_user_id', ['userId'])
export class ReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => BookingEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: BookingEntity;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string;

  @ManyToOne(() => HotelEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hotel_id' })
  hotel: HotelEntity;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'smallint' })
  stars: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 20, default: ReviewStatus.PENDING })
  status: ReviewStatus;

  @Column({ name: 'moderation_reason', type: 'text', nullable: true })
  moderationReason: string | null;

  @Column({ name: 'moderated_by', type: 'uuid', nullable: true })
  moderatedBy: string | null;

  @Column({ name: 'moderated_at', type: 'timestamptz', nullable: true })
  moderatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
