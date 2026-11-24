import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

const nullableDecimalTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity({ name: 'travel_preferences' })
export class TravelPreferenceEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'min_budget',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  minBudget: number | null;

  @Column({
    name: 'max_budget',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  maxBudget: number | null;

  @Column({ type: 'char', length: 3, default: 'VND' })
  currency: string;

  @Column({ name: 'preferred_duration_days', type: 'integer', nullable: true })
  preferredDurationDays: number | null;

  @Column({ name: 'travel_style', type: 'varchar', length: 50 })
  travelStyle: string;

  @Column({ name: 'preferred_transport', type: 'varchar', length: 50 })
  preferredTransport: string;

  @Column({ name: 'preferred_destinations', type: 'text', array: true, default: '{}' })
  preferredDestinations: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
