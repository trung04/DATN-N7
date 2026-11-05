import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'room_amenities' })
@Index('UQ_room_amenities_active_pair', ['roomId', 'amenityId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('IDX_room_amenities_amenity_id', ['amenityId'], {
  where: '"deleted_at" IS NULL',
})
export class RoomAmenityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @Column({ name: 'amenity_id', type: 'uuid' })
  amenityId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
