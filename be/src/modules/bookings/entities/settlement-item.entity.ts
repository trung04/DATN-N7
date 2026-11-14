import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'settlement_items' })
@Index('UQ_settlement_items_booking', ['bookingId'], { unique: true })
@Index('IDX_settlement_items_batch', ['settlementBatchId'])
export class SettlementItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'settlement_batch_id', type: 'uuid' })
  settlementBatchId: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @Column({ name: 'booking_code_snapshot', type: 'varchar', length: 50 })
  bookingCodeSnapshot: string;

  @Column({ name: 'check_out_date_snapshot', type: 'date' })
  checkOutDateSnapshot: string;

  @Column({ name: 'payment_reference_snapshot', type: 'varchar', length: 255, nullable: true })
  paymentReferenceSnapshot: string | null;

  @Column({ name: 'currency_snapshot', type: 'varchar', length: 10 })
  currencySnapshot: string;

  @Column({ name: 'gross_amount', type: 'numeric', precision: 14, scale: 2 })
  grossAmount: string;

  @Column({ name: 'commission_rate_snapshot', type: 'numeric', precision: 5, scale: 2 })
  commissionRateSnapshot: string;

  @Column({ name: 'commission_amount', type: 'numeric', precision: 14, scale: 2 })
  commissionAmount: string;

  @Column({ name: 'net_amount', type: 'numeric', precision: 14, scale: 2 })
  netAmount: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
