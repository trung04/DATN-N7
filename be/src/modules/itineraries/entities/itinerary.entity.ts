import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

export enum ItineraryStatus {
  DRAFT = 'DRAFT',
  SAVED = 'SAVED',
  ARCHIVED = 'ARCHIVED',
}

const decimalNumberTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity({ name: 'itineraries' })
@Index(
  'IDX_itineraries_active_tourist_updated',
  ['touristUserId', 'updatedAt'],
  {
    where: '"deleted_at" IS NULL',
  },
)
export class ItineraryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tourist_user_id', type: 'uuid' })
  touristUserId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'destination_city', type: 'varchar', length: 120 })
  destinationCity: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'varchar', length: 100 })
  timezone: string;

  @Column({ name: 'adult_count', type: 'integer' })
  adultCount: number;

  @Column({ name: 'child_count', type: 'integer' })
  childCount: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  budget: number | null;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 20 })
  status: ItineraryStatus;

  @Column({ name: 'is_ai_generated', type: 'boolean', default: false })
  isAiGenerated: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
