import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

const moneyTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string) => Number(value),
};

export enum SettlementBatchStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

@Entity({ name: 'settlement_batches' })
@Index('UQ_settlement_batches_hotel_period', ['hotelId', 'periodStart', 'periodEnd'], { unique: true })
@Index('IDX_settlement_batches_status_created', ['status', 'createdAt'])
export class SettlementBatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string;

  @Column({ name: 'hotel_name_snapshot', type: 'varchar', length: 200 })
  hotelNameSnapshot: string;

  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ name: 'booking_count', type: 'integer' })
  bookingCount: number;

  @Column({ name: 'gross_amount', type: 'numeric', precision: 14, scale: 2, transformer: moneyTransformer })
  grossAmount: number;

  @Column({ name: 'commission_amount', type: 'numeric', precision: 14, scale: 2, transformer: moneyTransformer })
  commissionAmount: number;

  @Column({ name: 'adjustment_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: moneyTransformer })
  adjustmentAmount: number;

  @Column({ name: 'net_amount', type: 'numeric', precision: 14, scale: 2, transformer: moneyTransformer })
  netAmount: number;

  @Column({ type: 'varchar', length: 20, default: SettlementBatchStatus.DRAFT })
  status: SettlementBatchStatus;

  @Column({ name: 'bank_name_snapshot', type: 'varchar', length: 100 })
  bankNameSnapshot: string;

  @Column({ name: 'bank_account_number_snapshot', type: 'varchar', length: 100 })
  bankAccountNumberSnapshot: string;

  @Column({ name: 'bank_account_holder_snapshot', type: 'varchar', length: 255 })
  bankAccountHolderSnapshot: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'processing_at', type: 'timestamptz', nullable: true })
  processingAt: Date | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt: Date | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'transfer_reference', type: 'varchar', length: 255, nullable: true, unique: true })
  transferReference: string | null;

  @Column({ type: 'integer', default: 1 })
  revision: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
