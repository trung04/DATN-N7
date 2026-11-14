import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HotelsService } from '../../hotels/services/hotels.service';
import { BookingEntity, SettlementStatus } from '../entities/booking.entity';
import { SettlementBatchStatus } from '../entities/settlement-batch.entity';
import { SETTLEMENT_REPOSITORY } from '../interfaces/settlement.repository.interface';
import type {
  SettlementBatchData,
  SettlementBatchWithItems,
  SettlementRepository,
  SettlementItemData,
} from '../interfaces/settlement.repository.interface';
import { CreateSettlementBatchRequest } from '../dtos/requests/create-settlement-batch.request';

@Injectable()
export class SettlementsService {
  constructor(
    @Inject(SETTLEMENT_REPOSITORY)
    private readonly repository: SettlementRepository,
    private readonly hotelsService: HotelsService,
  ) {}

  findPage(filters: { hotelId?: string; status?: string }) {
    return this.repository.findPage(filters);
  }

  async findById(id: string): Promise<SettlementBatchWithItems> {
    const batch = await this.repository.findById(id);
    if (!batch) throw new NotFoundException('Settlement batch not found.');
    return batch;
  }

  async create(input: CreateSettlementBatchRequest, adminUserId: string): Promise<SettlementBatchWithItems> {
    if (input.periodEnd < input.periodStart) {
      throw new BadRequestException('periodEnd must be on or after periodStart.');
    }
    const [destination, bookings] = await Promise.all([
      this.hotelsService.getSettlementDestination(input.hotelId),
      this.repository.findEligibleBookings(
        input.hotelId,
        input.periodStart,
        input.periodEnd,
      ),
    ]);
    if (bookings.length === 0) {
      throw new ConflictException('No eligible paid bookings were found in this period.');
    }
    const currencies = new Set(bookings.map((booking) => booking.currency));
    if (currencies.size !== 1) {
      throw new ConflictException('A settlement batch cannot contain multiple currencies.');
    }

    const items = bookings.map((booking) => this.toItem(booking));
    const grossAmount = this.roundMoney(
      items.reduce((sum, item) => sum + Number(item.grossAmount), 0),
    );
    const commissionAmount = this.roundMoney(
      items.reduce((sum, item) => sum + Number(item.commissionAmount), 0),
    );
    const batch: SettlementBatchData = {
      createdBy: adminUserId,
      hotelId: destination.hotelId,
      hotelNameSnapshot: destination.hotelName,
      ownerUserId: destination.ownerUserId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      currency: bookings[0].currency,
      bookingCount: bookings.length,
      grossAmount,
      commissionAmount,
      adjustmentAmount: 0,
      netAmount: this.roundMoney(grossAmount - commissionAmount),
      bankNameSnapshot: destination.bankName,
      bankAccountNumberSnapshot: destination.bankAccountNumber,
      bankAccountHolderSnapshot: destination.bankAccountHolder,
    };
    return this.repository.createBatch(batch, items);
  }

  async approve(id: string, adminUserId: string): Promise<SettlementBatchWithItems> {
    return this.transition(id, SettlementBatchStatus.DRAFT, SettlementBatchStatus.APPROVED, {
      approvedBy: adminUserId,
    }, adminUserId);
  }

  async start(id: string, adminUserId: string): Promise<SettlementBatchWithItems> {
    const current = await this.findById(id);
    if (![SettlementBatchStatus.APPROVED, SettlementBatchStatus.FAILED].includes(current.status)) {
      throw new ConflictException('Only an approved or failed batch can be sent for bank transfer.');
    }
    return this.transition(id, current.status, SettlementBatchStatus.PROCESSING, {}, adminUserId);
  }

  async confirm(
    id: string,
    transferReference: string,
    adminUserId: string,
  ): Promise<SettlementBatchWithItems> {
    return this.transition(
      id,
      SettlementBatchStatus.PROCESSING,
      SettlementBatchStatus.PAID,
      { transferReference },
      adminUserId,
    );
  }

  async fail(id: string, reason: string, adminUserId: string): Promise<SettlementBatchWithItems> {
    return this.transition(
      id,
      SettlementBatchStatus.PROCESSING,
      SettlementBatchStatus.FAILED,
      { failureReason: reason },
      adminUserId,
    );
  }

  private async transition(
    id: string,
    expectedStatus: SettlementBatchStatus,
    nextStatus: SettlementBatchStatus,
    data: { approvedBy?: string; transferReference?: string; failureReason?: string } = {},
    actorUserId: string,
  ): Promise<SettlementBatchWithItems> {
    const result = await this.repository.transition({
      id,
      expectedStatus,
      nextStatus,
      actorUserId,
      ...data,
    });
    if (!result) throw new NotFoundException('Settlement batch not found.');
    return result;
  }

  private toItem(booking: BookingEntity): SettlementItemData {
    const gross = this.roundMoney(booking.amount);
    const commission = this.roundMoney(
      (gross * booking.appliedCommissionRate) / 100,
    );
    return {
      bookingId: booking.id,
      bookingCodeSnapshot: booking.bookingCode,
      checkOutDateSnapshot: booking.checkOutDate,
      paymentReferenceSnapshot: booking.paymentTransactionId,
      currencySnapshot: booking.currency,
      grossAmount: gross.toFixed(2),
      commissionRateSnapshot: booking.appliedCommissionRate.toFixed(2),
      commissionAmount: commission.toFixed(2),
      netAmount: this.roundMoney(gross - commission).toFixed(2),
    };
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
