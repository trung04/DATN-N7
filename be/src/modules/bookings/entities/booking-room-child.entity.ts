import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  ValueTransformer,
} from 'typeorm';
import { BookingRoomEntity } from './booking-room.entity';

const decimalTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string) => Number(value),
};

@Entity({ name: 'booking_room_children' })
export class BookingRoomChildEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_room_id', type: 'uuid' })
  bookingRoomId: string;

  @Column({ name: 'age_at_check_in', type: 'smallint' })
  ageAtCheckIn: number;

  @Column({
    name: 'surcharge_per_night_snapshot',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  surchargePerNightSnapshot: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => BookingRoomEntity, (room) => room.childGuests, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_room_id' })
  bookingRoom: BookingRoomEntity;
}
