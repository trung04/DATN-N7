import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'stopovers' })
@Index('UQ_stopovers_active_order', ['itineraryId', 'stopOrder'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('IDX_stopovers_active_place', ['placeId'], {
  where: '"deleted_at" IS NULL',
})
@Index(
  'IDX_stopovers_active_schedule',
  ['itineraryId', 'arrivalTime', 'departureTime'],
  { where: '"deleted_at" IS NULL' },
)
export class StopoverEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'itinerary_id', type: 'uuid' })
  itineraryId: string;

  @Column({ name: 'place_id', type: 'uuid' })
  placeId: string;

  @Column({ name: 'stop_order', type: 'integer' })
  stopOrder: number;

  @Column({ name: 'arrival_time', type: 'timestamptz' })
  arrivalTime: Date;

  @Column({ name: 'departure_time', type: 'timestamptz' })
  departureTime: Date;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
