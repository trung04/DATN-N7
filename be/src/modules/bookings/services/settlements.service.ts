import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HotelsService } from '../../hotels/services/hotels.service';
import { BookingEntity, SettlementStatus } from '../entities/booking.entity';
import {
  SettlementBatchStatus,
  SettlementTransferMode,
} from '../entities/settlement-batch.entity';
import { SETTLEMENT_REPOSITORY } from '../interfaces/settlement.repository.interface';
import type {
  SettlementBatchData,
  SettlementBatchWithItems,
  SettlementRepository,
  SettlementItemData,
} from '../interfaces/settlement.repository.interface';
import { CreateSettlementBatchRequest } from '../dtos/requests/create-settlement-batch.request';
import { SEPAY_BANKHUB_PAYOUT } from '../interfaces/sepay-bankhub-payout.interface';
import type { SePayBankHubPayoutClient } from '../interfaces/sepay-bankhub-payout.interface';
import { SePayBankHubPayoutError } from '../integrations/sepay/sepay-bankhub-payout.client';

const payoutMemo = (batchId: string) => `HOTELSETTLEMENT-${batchId}`;

@Injectable()
export class SettlementsService {
  constructor(
    @Inject(SETTLEMENT_REPOSITORY)
    private readonly repository: SettlementRepository,
    private readonly hotelsService: HotelsService,
    @Inject(SEPAY_BANKHUB_PAYOUT)
    private readonly sepayPayout: SePayBankHubPayoutClient,
  ) {}

  findPage(filters: {
    hotelId?: string;
    status?: string;
    ownerUserId?: string;
  }) {
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
    let current = await this.findById(id);
    if (!this.sepayPayout.isConfigured()) {
      throw new ServiceUnavailableException(
        'SePay Bank Hub Sandbox is not configured. Add its sandbox client credentials and bank account UUID.',
      );
    }
    if (
      current.currency !== 'VND' ||
      !Number.isInteger(current.netAmount) ||
      current.netAmount <= 0
    ) {
      throw new BadRequestException(
        'Automatic SePay Sandbox payout requires a positive whole-number VND amount.',
      );
    }

    const memo = payoutMemo(current.id);
    if (current.status === SettlementBatchStatus.PROCESSING) {
      const existing = await this.findMatchingDebit(memo, current.netAmount);
      if (!existing) {
        throw new ConflictException(
          'No matching SePay Sandbox debit is visible yet. The system did not create a second transfer; retry reconciliation later.',
        );
      }
      return this.markSandboxPaid(current, existing, adminUserId);
    }

    if (current.status === SettlementBatchStatus.FAILED) {
      // A failed attempt can still have reached SePay before the connection broke.
      // Look it up before any retry so the same batch is never simulated twice.
      const existing = await this.findMatchingDebit(memo, current.netAmount);
      if (existing) {
        current = await this.transition(
          id,
          SettlementBatchStatus.FAILED,
          SettlementBatchStatus.PROCESSING,
          {
            transferMode: SettlementTransferMode.SEPAY_BANKHUB_SANDBOX,
            eventNote: 'Tìm thấy giao dịch Sandbox đã tạo; đang đồng bộ trạng thái.',
          },
          adminUserId,
        );
        return this.markSandboxPaid(current, existing, adminUserId);
      }
    } else if (current.status !== SettlementBatchStatus.APPROVED) {
      throw new ConflictException(
        'Only an approved or failed settlement can start a SePay Sandbox payout.',
      );
    }

    current = await this.transition(
      id,
      current.status,
      SettlementBatchStatus.PROCESSING,
      {
        transferMode: SettlementTransferMode.SEPAY_BANKHUB_SANDBOX,
        eventNote: 'Đã gửi yêu cầu mô phỏng chi tiền qua SePay Bank Hub Sandbox.',
      },
      adminUserId,
    );

    try {
      const existing = await this.findMatchingDebit(memo, current.netAmount);
      const debit = existing ?? (await this.sepayPayout.simulateDebit({
        amount: current.netAmount,
        transactionContent: memo,
      }));
      return this.markSandboxPaid(current, debit, adminUserId);
    } catch (error) {
      if (error instanceof SePayBankHubPayoutError) {
        if (!error.mayHaveSucceeded) {
          await this.transition(
            id,
            SettlementBatchStatus.PROCESSING,
            SettlementBatchStatus.FAILED,
            {
              failureReason: error.message,
              eventNote: 'SePay Sandbox từ chối yêu cầu mô phỏng chi tiền.',
            },
            adminUserId,
          );
          throw new BadGatewayException(
            'SePay Sandbox rejected the payout request. Review the configuration before retrying.',
          );
        }
        throw new ServiceUnavailableException(
          'SePay Sandbox may have created the debit, but its response was not confirmed. Use reconciliation; do not create another payout.',
        );
      }
      throw error;
    }
  }

  async confirm(
    id: string,
    transferReference: string,
    adminUserId: string,
  ): Promise<SettlementBatchWithItems> {
    const current = await this.findById(id);
    if (current.transferMode !== SettlementTransferMode.MANUAL) {
      throw new ConflictException(
        'A SePay Sandbox payout can only be marked paid from its provider transaction.',
      );
    }
    return this.transition(
      id,
      SettlementBatchStatus.PROCESSING,
      SettlementBatchStatus.PAID,
      { transferReference },
      adminUserId,
    );
  }

  async fail(id: string, reason: string, adminUserId: string): Promise<SettlementBatchWithItems> {
    const current = await this.findById(id);
    if (current.transferMode === SettlementTransferMode.SEPAY_BANKHUB_SANDBOX) {
      throw new ConflictException(
        'Do not mark a SePay Sandbox payout failed manually while its result may be unknown. Reconcile the provider transaction first.',
      );
    }
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
    data: {
      approvedBy?: string;
      transferReference?: string;
      transferMode?: SettlementTransferMode;
      providerTransferId?: string;
      failureReason?: string;
      eventNote?: string;
    } = {},
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

  private async findMatchingDebit(memo: string, expectedAmount: number) {
    const debit = await this.sepayPayout.findDebitByMemo(memo);
    if (debit && debit.amount !== expectedAmount) {
      throw new ConflictException(
        'A SePay transaction with this settlement memo has a different amount. Manual review is required.',
      );
    }
    return debit;
  }

  private markSandboxPaid(
    current: SettlementBatchWithItems,
    debit: {
      transactionId: string;
      referenceNumber: string;
      amount: number;
      transactionContent: string;
    },
    adminUserId: string,
  ): Promise<SettlementBatchWithItems> {
    if (
      debit.amount !== current.netAmount ||
      debit.transactionContent !== payoutMemo(current.id)
    ) {
      throw new ConflictException(
        'The SePay Sandbox transaction does not match this settlement.',
      );
    }
    return this.transition(
      current.id,
      SettlementBatchStatus.PROCESSING,
      SettlementBatchStatus.PAID,
      {
        transferReference: debit.referenceNumber,
        transferMode: SettlementTransferMode.SEPAY_BANKHUB_SANDBOX,
        providerTransferId: debit.transactionId,
        eventNote: 'SePay Sandbox đã ghi nhận giao dịch tiền ra mô phỏng.',
      },
      adminUserId,
    );
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
