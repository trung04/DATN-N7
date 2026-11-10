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

const decimalNumberTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity({ name: 'activities' })
@Index('UQ_activities_active_order', ['stopoverId', 'activityOrder'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index(
  'IDX_activities_active_schedule',
  ['stopoverId', 'startTime', 'endTime'],
  { where: '"deleted_at" IS NULL' },
)
export class ActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stopover_id', type: 'uuid' })
  stopoverId: string;

  @Column({ name: 'activity_order', type: 'integer' })
  activityOrder: number;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Column({
    name: 'estimated_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  estimatedCost: number | null;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
