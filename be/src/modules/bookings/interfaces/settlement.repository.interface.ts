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
  payoutBankBin: string | null;
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

export interface SettlementTransition {
  id: string;
  expectedStatus: string;
  nextStatus: string;
  expectedRevision?: number;
  approvedBy?: string;
  transferReference?: string;
  transferMode?: string;
  providerTransferId?: string;
  payoutRequestId?: string;
  payoutBankBin?: string;
  failureReason?: string;
  eventNote?: string;
  actorUserId: string | null;
}

export interface SettlementRepository {
  countLivePayments(bookingIds: string[]): Promise<number>;
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
    ownerUserId?: string;
  }): Promise<SettlementBatchWithItems[]>;
  findById(id: string): Promise<SettlementBatchWithItems | null>;
  findDuePayosPayoutIds(checkBefore: Date, limit: number): Promise<string[]>;
  claimPayosPayoutCheck(id: string, requestId: string, submit: boolean, checkBefore: Date): Promise<boolean>;
  transition(input: SettlementTransition): Promise<SettlementBatchWithItems | null>;
}
