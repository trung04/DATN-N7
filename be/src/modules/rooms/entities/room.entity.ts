import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

export enum RoomOperationalStatus {
  AVAILABLE = 'AVAILABLE',
  MAINTENANCE = 'MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

const decimalNumberTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string) => Number(value),
};

@Entity({ name: 'rooms' })
@Index('UQ_rooms_hotel_room_number', ['hotelId', 'roomNumber'], {
  unique: true,
})
@Index('IDX_rooms_hotel_id', ['hotelId'])
@Index('IDX_rooms_operational_status', ['operationalStatus'])
export class RoomEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string;

  @Column({ name: 'room_number', type: 'varchar', length: 30 })
  roomNumber: string;

  @Column({ name: 'max_occupancy', type: 'integer' })
  maxOccupancy: number;

  @Column({
    name: 'price_per_night',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalNumberTransformer,
  })
  pricePerNight: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'operational_status', type: 'varchar', length: 30 })
  operationalStatus: RoomOperationalStatus;

  @Column({ name: 'room_type', type: 'varchar', length: 60 })
  roomType: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
