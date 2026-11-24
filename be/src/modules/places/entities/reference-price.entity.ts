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

const decimalTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity({ name: 'reference_prices' })
@Index(
  'IDX_reference_prices_active_place_type',
  ['placeId', 'costType', 'validFrom'],
  { where: '"deleted_at" IS NULL' },
)
export class ReferencePriceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'place_id', type: 'uuid' })
  placeId: string;

  @Column({ name: 'cost_type', type: 'varchar', length: 60 })
  costType: string;

  @Column({
    name: 'min_price',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  minPrice: number;

  @Column({
    name: 'max_price',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  maxPrice: number;

  @Column({ type: 'char', length: 3, default: 'VND' })
  currency: string;

  @Column({ name: 'pricing_unit', type: 'varchar', length: 60 })
  pricingUnit: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'price_source',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  priceSource: string | null;

  @Column({
    name: 'confidence_score',
    type: 'numeric',
    precision: 4,
    scale: 3,
    nullable: true,
    transformer: decimalTransformer,
  })
  confidenceScore: number | null;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom: string | null;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
