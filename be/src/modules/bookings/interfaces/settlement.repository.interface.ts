import { BookingEntity } from '../entities/booking.entity';
import { SettlementBatchEntity } from '../entities/settlement-batch.entity';
import { SettlementItemEntity } from '../entities/settlement-item.entity';
import { SettlementBatchEventEntity } from '../entities/settlement-batch-event.entity';

export const SETTLEMENT_REPOSITORY = Symbol('SETTLEMENT_REPOSITORY');

export type SettlementBatchWithItems = SettlementBatchEntity & {
  items: SettlementItemEntity[];
  events: SettlementBatchEventEntity[];
};

export interface SettlementBatchData {
  createdBy: string;
  hotelId: string;
  hotelNameSnapshot: string;
  ownerUserId: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  bookingCount: number;
  grossAmount: number;
  commissionAmount: number;
  adjustmentAmount: number;
  netAmount: number;
  bankNameSnapshot: string;
  bankAccountNumberSnapshot: string;
  bankAccountHolderSnapshot: string;
}

export type SettlementItemData = Pick<
  SettlementItemEntity,
  | 'bookingId'
  | 'bookingCodeSnapshot'
  | 'checkOutDateSnapshot'
  | 'paymentReferenceSnapshot'
  | 'currencySnapshot'
  | 'grossAmount'
  | 'commissionRateSnapshot'
  | 'commissionAmount'
  | 'netAmount'
>;

export interface SettlementRepository {
  findEligibleBookings(
    hotelId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<BookingEntity[]>;
  createBatch(
    batch: SettlementBatchData,
    items: SettlementItemData[],
  ): Promise<SettlementBatchWithItems>;
  findPage(filters: {
    hotelId?: string;
    status?: string;
  }): Promise<SettlementBatchWithItems[]>;
  findById(id: string): Promise<SettlementBatchWithItems | null>;
  transition(input: {
    id: string;
    expectedStatus: string;
    nextStatus: string;
    approvedBy?: string;
    transferReference?: string;
    failureReason?: string;
    actorUserId: string;
  }): Promise<SettlementBatchWithItems | null>;
}
