import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  ValueTransformer,
} from 'typeorm';
import { BookingEntity } from './booking.entity';

const decimalTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string) => Number(value),
};

@Entity({ name: 'booking_rooms' })
@Index('UQ_booking_rooms_booking_room', ['bookingId', 'roomId'], {
  unique: true,
})
@Index('IDX_booking_rooms_room_id', ['roomId'])
export class BookingRoomEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @Column({ name: 'room_number_snapshot', type: 'varchar', length: 30 })
  roomNumberSnapshot: string;

  @Column({ name: 'room_type_snapshot', type: 'varchar', length: 60 })
  roomTypeSnapshot: string;

  @Column({ name: 'max_occupancy_snapshot', type: 'integer' })
  maxOccupancySnapshot: number;

  @Column({
    name: 'price_per_night',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  pricePerNight: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'number_of_nights', type: 'integer' })
  numberOfNights: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  subtotal: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => BookingEntity, (booking) => booking.roomItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking: BookingEntity;
}
