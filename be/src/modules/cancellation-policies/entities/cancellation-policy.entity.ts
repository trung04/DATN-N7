import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

const decimalTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string) => Number(value),
};

@Entity({ name: 'cancellation_policies' })
@Index('IDX_cancellation_policies_hotel_id', ['hotelId'])
@Index('UQ_cancellation_policies_one_active_per_hotel', ['hotelId'], {
  unique: true,
  where: 'is_active = true',
})
export class CancellationPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'cancel_hours', type: 'integer', default: 24 })
  cancelHours: number;

  @Column({
    name: 'penalty_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  penaltyPercent: number;

  @Column({ name: 'cancellation_allowed', type: 'boolean', default: true })
  cancellationAllowed: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
