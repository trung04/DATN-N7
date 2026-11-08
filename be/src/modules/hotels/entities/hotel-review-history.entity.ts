import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HotelEntity } from './hotel.entity';

export enum HotelReviewAction {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
  REACTIVATED = 'REACTIVATED',
  DEACTIVATED = 'DEACTIVATED',
}

@Entity({ name: 'hotel_review_histories' })
@Index('IDX_hotel_review_histories_hotel_id', ['hotelId'])
export class HotelReviewHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId: string;

  @Column({ type: 'varchar', length: 30 })
  action: HotelReviewAction;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => HotelEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hotel_id' })
  hotel: HotelEntity;
}
