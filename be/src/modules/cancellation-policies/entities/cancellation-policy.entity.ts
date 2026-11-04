import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  ValueTransformer,
} from 'typeorm';

const nullableDecimalTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity({ name: 'cancellation_policies' })
@Index('IDX_cancellation_policies_hotel_id', ['hotelId'])
export class CancellationPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'cancellation_window', type: 'integer', nullable: true })
  cancellationWindow: number | null;

  @Column({
    name: 'cancellation_fee_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  cancellationFeeRate: number | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
