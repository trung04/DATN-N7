import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { HotelsService } from '../../hotels/services/hotels.service';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { UserRole } from '../../users/entities/user.entity';
import { BookingEntity } from '../entities/booking.entity';
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
  SettlementTransition,
} from '../interfaces/settlement.repository.interface';
import { PAYOS_GATEWAY } from '../interfaces/payos-gateway.interface';
import type { PayosGateway, PayosRefundInput, PayosRefundResult } from '../interfaces/payos-gateway.interface';
import { resolveBankBin } from '../../hotel-owners/catalog/vietqr-banks';
import { CreateSettlementBatchRequest } from '../dtos/requests/create-settlement-batch.request';
const PAYOUT_POLL_INTERVAL_MS = 10_000;
const PAYOUT_RECHECK_MS = 30_000;
const PAYOUTS_PER_POLL = 10;

@Injectable()
export class SettlementsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettlementsService.name);
  private payoutPoller?: ReturnType<typeof setInterval>;
  private processingPayouts = false;

  constructor(
    @Inject(SETTLEMENT_REPOSITORY)
    private readonly repository: SettlementRepository,
    private readonly hotelsService: HotelsService,
    @Inject(PAYOS_GATEWAY)
    private readonly payos: PayosGateway,
  ) {}

  onModuleInit(): void {
    this.payoutPoller = setInterval(() => { void this.processPendingPayouts(); }, PAYOUT_POLL_INTERVAL_MS);
    this.payoutPoller.unref();
  }

  onModuleDestroy(): void {
    if (this.payoutPoller) clearInterval(this.payoutPoller);
  }

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

  findMine(ownerUserId: string) {
    return this.repository.findPage({ ownerUserId });
  }

  async findForAdmin(id: string) {
    const batch = await this.findById(id);
    return {
      ...batch,
      payoutUnavailableReason: this.canRequestPayout(batch) ? await this.payoutUnavailableReason(batch) : null,
    };
  }

  async requestPayout(id: string, revision: number, actor: AuthorizationActor): Promise<SettlementBatchWithItems> {
    if (actor.role !== UserRole.ADMIN) throw new AuthorizationDeniedException();
    const batch = await this.findById(id);
    if (this.hasActivePayout(batch)) return batch;
    if (!this.canRequestPayout(batch) || batch.revision !== revision) {
      throw new ConflictException('Kỳ đối soát đã thay đổi hoặc chưa được duyệt. Hãy kiểm tra lại trước khi xác nhận chi trả.');
    }
    if (!this.payos.isPayoutConfigured()) throw new ServiceUnavailableException('Kênh chi payOS chưa sẵn sàng.');
    const bankBin = batch.payoutBankBin ?? resolveBankBin(batch.bankNameSnapshot);
    const unavailable = await this.payoutUnavailableReason(batch, bankBin);
    if (unavailable) throw new ConflictException(unavailable);

    let queued: SettlementBatchWithItems;
    try {
      queued = await this.transition(id, batch.status, SettlementBatchStatus.PROCESSING, {
        expectedRevision: revision,
        transferMode: SettlementTransferMode.PAYOS,
        payoutRequestId: randomUUID().replaceAll('-', ''),
        payoutBankBin: bankBin!,
        eventNote: 'Quản trị viên đã xác nhận chi trả cho khách sạn qua payOS.',
      }, actor.id);
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      const latest = await this.findById(id);
      if (this.hasActivePayout(latest)) return latest;
      throw error;
    }

    await this.checkPayout(queued, new Date(Date.now() - PAYOUT_RECHECK_MS));
    return this.findById(id);
  }

  async processPendingPayouts(): Promise<void> {
    if (this.processingPayouts || !this.payos.isPayoutConfigured()) return;
    this.processingPayouts = true;
    try {
      const checkBefore = new Date(Date.now() - PAYOUT_RECHECK_MS);
      const ids = await this.repository.findDuePayosPayoutIds(checkBefore, PAYOUTS_PER_POLL);
      for (const id of ids) {
        try {
          const batch = await this.repository.findById(id);
          if (batch) await this.checkPayout(batch, checkBefore);
        } catch {
          this.logger.warn('Could not reconcile a payOS hotel payout.');
        }
      }
    } catch {
      this.logger.warn('Could not load pending payOS hotel payouts.');
    } finally {
      this.processingPayouts = false;
    }
  }

  private async checkPayout(batch: SettlementBatchWithItems, checkBefore: Date): Promise<void> {
    const { payoutRequestId, payoutBankBin } = batch;
    if (batch.transferMode !== SettlementTransferMode.PAYOS || batch.status !== SettlementBatchStatus.PROCESSING ||
        !payoutRequestId || !payoutBankBin) return;
    const submit = batch.payoutSubmittedAt === null;
    if (submit && (await this.hotelsService.findById(batch.hotelId)).ownerUserId !== batch.ownerUserId) {
      await this.transition(batch.id, batch.status, SettlementBatchStatus.FAILED, {
        expectedRevision: batch.revision,
        failureReason: 'Chủ khách sạn đã thay đổi trước khi gửi lệnh chi.',
      }, null);
      return;
    }
    if (!await this.repository.claimPayosPayoutCheck(batch.id, payoutRequestId, submit, checkBefore)) return;
    const input: PayosRefundInput = {
      requestId: payoutRequestId,
      amount: batch.netAmount,
      destination: { bank: payoutBankBin, account: batch.bankAccountNumberSnapshot.trim() },
    };

    let result: PayosRefundResult;
    try {
      result = submit ? await this.payos.submitSettlementPayout(input) : await this.payos.getSettlementPayout(input);
    } catch {
      // An uncertain submission is reconciled by its existing reference. Never send a second payout.
      this.logger.warn('A payOS hotel payout still needs reconciliation.');
      return;
    }
    if (result.status === 'succeeded' && result.reference) {
      await this.transition(batch.id, batch.status, SettlementBatchStatus.PAID, {
        expectedRevision: batch.revision,
        transferReference: result.reference,
        providerTransferId: result.payoutId,
        eventNote: 'payOS xác nhận đã chuyển tiền cho khách sạn.',
      }, null);
    } else if (result.status === 'rejected') {
      await this.transition(batch.id, batch.status, SettlementBatchStatus.FAILED, {
        expectedRevision: batch.revision,
        failureReason: 'payOS xác nhận giao dịch chi trả không thành công.',
      }, null);
    }
  }

  private canRequestPayout(batch: SettlementBatchWithItems): boolean {
    return (batch.status === SettlementBatchStatus.APPROVED && batch.transferMode === SettlementTransferMode.MANUAL) ||
      (batch.status === SettlementBatchStatus.FAILED && batch.transferMode === SettlementTransferMode.PAYOS);
  }

  private hasActivePayout(batch: SettlementBatchWithItems): boolean {
    return batch.transferMode === SettlementTransferMode.PAYOS &&
      [SettlementBatchStatus.PROCESSING, SettlementBatchStatus.PAID].includes(batch.status);
  }

  private async payoutUnavailableReason(
    batch: SettlementBatchWithItems,
    bankBin = batch.payoutBankBin ?? resolveBankBin(batch.bankNameSnapshot),
  ): Promise<string | null> {
    if (!this.payos.isPayoutConfigured()) return 'Kênh chi payOS chưa sẵn sàng.';
    if (batch.currency !== 'VND' || !Number.isSafeInteger(batch.netAmount) || batch.netAmount <= 0) {
      return 'Kỳ đối soát cần có số tiền VND nguyên và lớn hơn 0 để chi qua payOS.';
    }
    if (!bankBin || !/^\d{4,24}$/.test(batch.bankAccountNumberSnapshot.trim())) {
      return 'Tài khoản ngân hàng trong bảng kê chưa hỗ trợ chi qua payOS.';
    }
    const bookingIds = batch.items.map((item) => item.bookingId);
    if (!bookingIds.length || await this.repository.countLivePayments(bookingIds) !== bookingIds.length) {
      return 'Kỳ đối soát có booking thử nghiệm hoặc chưa đủ điều kiện chi trả.';
    }
    if ((await this.hotelsService.findById(batch.hotelId)).ownerUserId !== batch.ownerUserId) {
      return 'Chủ khách sạn đã thay đổi so với thông tin trong bảng kê.';
    }
    return null;
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
      payoutBankBin: destination.bankBin ?? null,
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
    if (current.transferMode !== SettlementTransferMode.MANUAL ||
      current.status !== SettlementBatchStatus.FAILED || !current.processingAt) {
      throw new ConflictException('Only a previously started manual settlement can retry a manual payout.');
    }
    await this.assertLivePayments(current);
    return this.transition(id, current.status, SettlementBatchStatus.PROCESSING, {
      eventNote: 'Đang chờ chuyển khoản thủ công cho khách sạn.',
      expectedRevision: current.revision,
    }, adminUserId);
  }

  async confirm(
    id: string,
    transferReference: string,
    adminUserId: string,
  ): Promise<SettlementBatchWithItems> {
    const current = await this.findById(id);
    if (current.transferMode !== SettlementTransferMode.MANUAL) {
      throw new ConflictException(
        'Only manual payouts can be confirmed using a bank transfer reference.',
      );
    }
    await this.assertLivePayments(current);
    return this.transition(
      id,
      SettlementBatchStatus.PROCESSING,
      SettlementBatchStatus.PAID,
      { transferReference, expectedRevision: current.revision },
      adminUserId,
    );
  }

  async fail(id: string, reason: string, adminUserId: string): Promise<SettlementBatchWithItems> {
    const current = await this.findById(id);
    if (current.transferMode !== SettlementTransferMode.MANUAL) {
      throw new ConflictException(
        'Only manual payouts can be marked failed by an admin.',
      );
    }
    return this.transition(
      id,
      SettlementBatchStatus.PROCESSING,
      SettlementBatchStatus.FAILED,
      { failureReason: reason, expectedRevision: current.revision },
      adminUserId,
    );
  }

  private async assertLivePayments(batch: SettlementBatchWithItems): Promise<void> {
    const bookingIds = batch.items.map((item) => item.bookingId);
    if (!bookingIds.length || await this.repository.countLivePayments(bookingIds) !== bookingIds.length) {
      throw new ConflictException('Test payments cannot enter a real hotel settlement.');
    }
  }

  private async transition(
    id: string,
    expectedStatus: SettlementBatchStatus,
    nextStatus: SettlementBatchStatus,
    data: Omit<SettlementTransition, 'id' | 'expectedStatus' | 'nextStatus' | 'actorUserId'> = {},
    actorUserId: string | null,
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
    const calculatedCommission = (gross * booking.appliedCommissionRate) / 100;
    const commission = booking.currency === 'VND' ? Math.round(calculatedCommission) : this.roundMoney(calculatedCommission);
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
