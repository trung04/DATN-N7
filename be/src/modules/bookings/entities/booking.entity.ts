import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';
import { BookingRoomEntity } from './booking-room.entity';

const nullableDecimalTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

const decimalTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string) => Number(value),
};

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum PaymentMethod {
  QR = 'QR',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SETTLED = 'SETTLED',
  FAILED = 'FAILED',
}

export enum RefundStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export interface BookingCancellationRuleSnapshot {
  id: string;
  name: string;
  cancelHours?: number;
  penaltyPercent?: number;
  minHoursAfterBooking?: number;
  maxHoursAfterBooking?: number | null;
  minHoursBeforeCheckIn?: number;
  maxHoursBeforeCheckIn?: number | null;
  cancellationAllowed: boolean;
  cancellationFeeRate: number | null;
  description: string | null;
}

export interface BookingCancellationPolicySnapshot {
  version: string;
  basis?: 'HOURS_AFTER_BOOKING' | 'HOURS_BEFORE_CHECK_IN';
  cancelHours?: number;
  penaltyPercent?: number;
  cancellationAllowed?: boolean;
  policyName?: string;
  policyDescription?: string | null;
  timezone: 'Asia/Ho_Chi_Minh';
  checkInTime: string;
  rules: BookingCancellationRuleSnapshot[];
}

@Entity({ name: 'bookings' })
@Index('UQ_bookings_booking_code', ['bookingCode'], { unique: true })
@Index('IDX_bookings_hotel_id', ['hotelId'])
@Index('IDX_bookings_tourist_id', ['touristId'])
@Index('IDX_bookings_booking_status', ['bookingStatus'])
@Index('IDX_bookings_payment_status', ['paymentStatus'])
@Index('IDX_bookings_created_at', ['createdAt'])
export class BookingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string;

  @Column({ name: 'tourist_id', type: 'uuid' })
  touristId: string;

  @Column({ name: 'booking_code', type: 'varchar', length: 50 })
  bookingCode: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'check_in_date', type: 'date' })
  checkInDate: string;

  @Column({ name: 'check_out_date', type: 'date' })
  checkOutDate: string;

  @Column({ name: 'adult_count', type: 'integer' })
  adultCount: number;

  @Column({ name: 'child_count', type: 'integer', default: 0 })
  childCount: number;

  @Column({ name: 'guest_name', type: 'varchar', length: 255 })
  guestName: string;

  @Column({ name: 'guest_email', type: 'varchar', length: 255 })
  guestEmail: string;

  @Column({ name: 'guest_phone', type: 'varchar', length: 30 })
  guestPhone: string;

  @Column({ name: 'special_requests', type: 'text', nullable: true })
  specialRequests: string | null;

  @Column({ name: 'booking_status', type: 'varchar', length: 30 })
  bookingStatus: BookingStatus;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'reservation_expires_at', type: 'timestamptz' })
  reservationExpiresAt: Date;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount: number;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({
    name: 'applied_commission_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: decimalTransformer,
  })
  appliedCommissionRate: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({
    name: 'payment_method',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'payment_created_at', type: 'timestamptz', nullable: true })
  paymentCreatedAt: Date | null;

  @Column({ name: 'payment_expires_at', type: 'timestamptz', nullable: true })
  paymentExpiresAt: Date | null;

  @Column({ name: 'payment_status', type: 'varchar', length: 30 })
  paymentStatus: PaymentStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({
    name: 'payment_transaction_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  paymentTransactionId: string | null;

  @Column({ name: 'sepay_order_xid', type: 'varchar', length: 100, nullable: true })
  sepayOrderXid: string | null;

  @Column({ name: 'sepay_order_code', type: 'varchar', length: 50, nullable: true })
  sepayOrderCode: string | null;

  @Column({ name: 'sepay_va_number', type: 'varchar', length: 100, nullable: true })
  sepayVaNumber: string | null;

  @Column({ name: 'sepay_qr_code', type: 'text', nullable: true })
  sepayQrCode: string | null;

  @Column({ name: 'sepay_bank_name', type: 'varchar', length: 100, nullable: true })
  sepayBankName: string | null;

  @Column({ name: 'sepay_account_number', type: 'varchar', length: 100, nullable: true })
  sepayAccountNumber: string | null;

  @Column({ name: 'sepay_account_holder_name', type: 'varchar', length: 255, nullable: true })
  sepayAccountHolderName: string | null;

  @Column({ name: 'sepay_order_status', type: 'varchar', length: 30, nullable: true })
  sepayOrderStatus: string | null;

  @Column({
    name: 'settlement_base_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  settlementBaseAmount: number | null;

  @Column({
    name: 'commission_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  commissionAmount: number | null;

  @Column({
    name: 'partner_receivable_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  partnerReceivableAmount: number | null;

  @Column({ name: 'settlement_status', type: 'varchar', length: 30 })
  settlementStatus: SettlementStatus;

  @Column({
    name: 'transaction_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  transactionId: string | null;

  @Column({
    name: 'bank_name_snapshot',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  bankNameSnapshot: string | null;

  @Column({
    name: 'bank_account_number_snapshot',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  bankAccountNumberSnapshot: string | null;

  @Column({
    name: 'bank_account_holder_snapshot',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  bankAccountHolderSnapshot: string | null;

  @Column({ name: 'settled_at', type: 'timestamptz', nullable: true })
  settledAt: Date | null;

  @Column({ name: 'cancellation_policy_id', type: 'uuid', nullable: true })
  cancellationPolicyId: string | null;

  @Column({ name: 'cancellation_policy_snapshot', type: 'jsonb', nullable: true })
  cancellationPolicySnapshot: BookingCancellationPolicySnapshot | null;

  @Column({
    name: 'cancellation_window_snapshot',
    type: 'integer',
    nullable: true,
  })
  cancellationWindowSnapshot: number | null;

  @Column({
    name: 'cancellation_fee_rate_snapshot',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  cancellationFeeRateSnapshot: number | null;

  @Column({
    name: 'cancellation_description_snapshot',
    type: 'text',
    nullable: true,
  })
  cancellationDescriptionSnapshot: string | null;

  @Column({
    name: 'cancellation_fee_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  cancellationFeeAmount: number | null;

  @Column({
    name: 'refund_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  refundAmount: number | null;

  @Column({ name: 'refund_reason', type: 'text', nullable: true })
  refundReason: string | null;

  @Column({ name: 'refund_requested_at', type: 'timestamptz', nullable: true })
  refundRequestedAt: Date | null;

  @Column({ name: 'refund_processing_at', type: 'timestamptz', nullable: true })
  refundProcessingAt: Date | null;

  @Column({ name: 'refund_attempt', type: 'integer', default: 0 })
  refundAttempt: number;

  @Column({ name: 'refund_failure_reason', type: 'text', nullable: true })
  refundFailureReason: string | null;

  @Column({ name: 'refund_failed_at', type: 'timestamptz', nullable: true })
  refundFailedAt: Date | null;

  @Column({ name: 'refund_handled_by', type: 'uuid', nullable: true })
  refundHandledBy: string | null;

  @Column({ name: 'refund_status', type: 'varchar', length: 30 })
  refundStatus: RefundStatus;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  @Column({
    name: 'refund_transaction_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  refundTransactionId: string | null;

  @Column({ name: 'sepay_refund_id', type: 'varchar', length: 100, nullable: true })
  sepayRefundId: string | null;

  @Column({ name: 'sepay_refund_idempotency_key', type: 'varchar', length: 100, nullable: true })
  sepayRefundIdempotencyKey: string | null;

  @Column({ name: 'sepay_refund_provider_status', type: 'varchar', length: 30, nullable: true })
  sepayRefundProviderStatus: string | null;

  @OneToMany(() => BookingRoomEntity, (item) => item.booking)
  roomItems: BookingRoomEntity[];
}
