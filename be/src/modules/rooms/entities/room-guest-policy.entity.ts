import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

const decimalTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string) => Number(value),
};

/** Guest rules shared by physical rooms with the same hotel and room_type string. */
@Entity({ name: 'room_guest_policies' })
export class RoomGuestPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string;

  @Column({ name: 'room_type', type: 'varchar', length: 60 })
  roomType: string;

  @Column({ name: 'max_adults', type: 'integer' })
  maxAdults: number;

  @Column({ name: 'max_children', type: 'integer' })
  maxChildren: number;

  @Column({ name: 'adult_age_from', type: 'integer', default: 12 })
  adultAgeFrom: number;

  @Column({ name: 'free_child_max_age', type: 'integer', default: 11 })
  freeChildMaxAge: number;

  @Column({
    name: 'child_surcharge_per_night',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  childSurchargePerNight: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
