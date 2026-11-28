import { ConflictException } from '@nestjs/common';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import type { HotelsService } from '../../hotels/services/hotels.service';
import { UserRole } from '../../users/entities/user.entity';
import { BookingEntity, PaymentProvider } from '../entities/booking.entity';
import {
  SettlementBatchEntity,
  SettlementBatchStatus,
  SettlementTransferMode,
} from '../entities/settlement-batch.entity';
import { SettlementItemEntity } from '../entities/settlement-item.entity';
import type { SettlementRepository } from '../interfaces/settlement.repository.interface';
import type { PayosGateway } from '../interfaces/payos-gateway.interface';
import { SettlementsService } from './settlements.service';

describe('Production settlements', () => {
  const adminId = 'admin';
  const admin = { id: adminId, role: UserRole.ADMIN };
  const booking = Object.assign(new BookingEntity(), {
    id: 'booking',
    amount: 1_000_000,
    appliedCommissionRate: 15,
    currency: 'VND',
    paymentProvider: PaymentProvider.LEGACY_LIVE,
  });
  const batch = Object.assign(new SettlementBatchEntity(), {
    id: 'batch',
    hotelId: 'hotel',
    ownerUserId: 'owner',
    revision: 2,
    currency: 'VND',
    netAmount: 850_000,
    bankNameSnapshot: 'Ngân hàng Techcombank',
    bankAccountNumberSnapshot: '0123456789',
    status: SettlementBatchStatus.APPROVED,
    transferMode: SettlementTransferMode.MANUAL,
    items: [Object.assign(new SettlementItemEntity(), { bookingId: booking.id })],
    events: [],
  });
  const repository: jest.Mocked<SettlementRepository> = {
    findById: jest.fn(),
    findPage: jest.fn(),
    findEligibleBookings: jest.fn(),
    countLivePayments: jest.fn(),
    createBatch: jest.fn(),
    transition: jest.fn(),
    findDuePayosPayoutIds: jest.fn(),
    claimPayosPayoutCheck: jest.fn(),
  };
  const hotels = {
    getSettlementDestination: jest.fn().mockResolvedValue({ hotelId: 'hotel' }),
    findById: jest.fn().mockResolvedValue({ ownerUserId: batch.ownerUserId }),
  };
  const payos = {
    isPayoutConfigured: jest.fn().mockReturnValue(true),
    submitSettlementPayout: jest.fn(),
    getSettlementPayout: jest.fn(),
  };
  const service = new SettlementsService(
    repository,
    hotels as unknown as HotelsService,
    payos as unknown as PayosGateway,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findById.mockResolvedValue(batch);
    repository.countLivePayments.mockResolvedValue(1);
    repository.transition.mockResolvedValue({ ...batch, status: SettlementBatchStatus.PROCESSING });
    repository.claimPayosPayoutCheck.mockResolvedValue(true);
  });

  it('calculates the payable balance using the eligible payments', async () => {
    repository.findEligibleBookings.mockResolvedValue([booking]);
    repository.createBatch.mockResolvedValue(batch);
    hotels.getSettlementDestination.mockResolvedValueOnce({ hotelId: 'hotel', bankBin: '970407' });

    await service.create({ hotelId: 'hotel', periodStart: '2026-11-01', periodEnd: '2026-11-30' }, adminId);
    expect(repository.createBatch).toHaveBeenCalledWith(
      expect.objectContaining({ bookingCount: 1, commissionAmount: 150_000, netAmount: 850_000, payoutBankBin: '970407' }),
      [expect.objectContaining({ bookingId: booking.id })],
    );
  });

  it('lets an admin resume a previously started manual transfer', async () => {
    repository.findById.mockResolvedValue({ ...batch, status: SettlementBatchStatus.FAILED, processingAt: new Date() });
    const started = await service.start(batch.id, adminId);

    expect(started.status).toBe(SettlementBatchStatus.PROCESSING);
    expect(repository.transition).toHaveBeenCalledWith(expect.objectContaining({
      expectedStatus: SettlementBatchStatus.FAILED,
      nextStatus: SettlementBatchStatus.PROCESSING,
    }));
  });

  it('requires an administrator, an approved batch, and the current revision', async () => {
    await expect(service.requestPayout(batch.id, batch.revision, {
      id: batch.ownerUserId,
      role: UserRole.HOTEL_OWNER,
    })).rejects.toThrow(AuthorizationDeniedException);
    await expect(service.requestPayout(batch.id, 1, admin)).rejects.toThrow('đã thay đổi');
    await expect(service.start(batch.id, adminId)).rejects.toThrow('previously started');
    repository.findById.mockResolvedValueOnce({ ...batch, status: SettlementBatchStatus.DRAFT });
    await expect(service.requestPayout(batch.id, batch.revision, admin)).rejects.toThrow('chưa được duyệt');
    expect(repository.transition).not.toHaveBeenCalled();
    expect(payos.submitSettlementPayout).not.toHaveBeenCalled();
  });

  it('approves a batch without submitting a payout', async () => {
    repository.transition.mockResolvedValueOnce(batch);

    await service.approve(batch.id, adminId);

    expect(repository.transition).toHaveBeenCalledWith(expect.objectContaining({
      expectedStatus: SettlementBatchStatus.DRAFT,
      nextStatus: SettlementBatchStatus.APPROVED,
      actorUserId: adminId,
    }));
    expect(payos.submitSettlementPayout).not.toHaveBeenCalled();
  });

  it('does not submit when the approved batch contains test payments', async () => {
    repository.countLivePayments.mockResolvedValue(0);
    await expect(service.requestPayout(batch.id, batch.revision, admin)).rejects.toThrow('thử nghiệm');
    expect(repository.transition).not.toHaveBeenCalled();
    expect(payos.submitSettlementPayout).not.toHaveBeenCalled();
  });

  it('submits one payout on concurrent admin confirmations and records the verified result', async () => {
    let current = { ...batch };
    repository.findById.mockImplementation(async () => current);
    repository.transition.mockImplementation(async input => {
      if (current.revision !== input.expectedRevision) throw new ConflictException();
      current = {
        ...current,
        status: input.nextStatus as SettlementBatchStatus,
        transferMode: (input.transferMode as SettlementTransferMode) ?? current.transferMode,
        payoutRequestId: input.payoutRequestId ?? current.payoutRequestId,
        payoutBankBin: input.payoutBankBin ?? current.payoutBankBin,
        payoutSubmittedAt: null,
        transferReference: input.transferReference ?? current.transferReference,
        revision: current.revision + 1,
      };
      return current;
    });
    payos.submitSettlementPayout.mockResolvedValue({ status: 'succeeded', reference: 'TX-01', payoutId: 'PAYOUT-01' });

    await Promise.all([
      service.requestPayout(batch.id, batch.revision, admin),
      service.requestPayout(batch.id, batch.revision, admin),
    ]);

    expect(payos.submitSettlementPayout).toHaveBeenCalledTimes(1);
    expect(payos.submitSettlementPayout).toHaveBeenCalledWith({
      requestId: expect.stringMatching(/^[0-9a-f]{32}$/),
      amount: batch.netAmount,
      destination: { bank: '970407', account: batch.bankAccountNumberSnapshot },
    });
    expect(current).toMatchObject({ status: SettlementBatchStatus.PAID, transferReference: 'TX-01' });
    expect(repository.transition).toHaveBeenCalledWith(expect.objectContaining({
      nextStatus: SettlementBatchStatus.PROCESSING,
      actorUserId: adminId,
    }));
    expect(repository.transition).toHaveBeenCalledWith(expect.objectContaining({
      nextStatus: SettlementBatchStatus.PAID,
      actorUserId: null,
    }));
  });

  it('looks up a previously submitted payout without sending another transfer', async () => {
    const processing = {
      ...batch,
      status: SettlementBatchStatus.PROCESSING,
      transferMode: SettlementTransferMode.PAYOS,
      payoutRequestId: 'payout-reference',
      payoutBankBin: '970407',
      payoutSubmittedAt: new Date(),
    };
    repository.findById.mockResolvedValue(processing);
    repository.findDuePayosPayoutIds.mockResolvedValue([processing.id]);
    payos.getSettlementPayout.mockResolvedValue({ status: 'pending' });
    await service.requestPayout(processing.id, batch.revision, admin);
    await service.processPendingPayouts();
    expect(payos.getSettlementPayout).toHaveBeenCalledWith(expect.objectContaining({ requestId: processing.payoutRequestId }));
    expect(payos.submitSettlementPayout).not.toHaveBeenCalled();
    expect(repository.transition).not.toHaveBeenCalled();
  });

  it('does not let an admin confirm or fail a payOS payout', async () => {
    repository.findById.mockResolvedValue({ ...batch, transferMode: SettlementTransferMode.PAYOS, status: SettlementBatchStatus.PROCESSING });
    await expect(service.confirm(batch.id, 'TX-01', adminId)).rejects.toThrow('Only manual payouts');
    await expect(service.fail(batch.id, 'test', adminId)).rejects.toThrow('Only manual payouts');
    expect(repository.transition).not.toHaveBeenCalled();
  });

  it('rejects a legacy sandbox batch before starting any transfer', async () => {
    repository.findById.mockResolvedValue({ ...batch, transferMode: SettlementTransferMode.LEGACY_SIMULATED });

    await expect(service.start(batch.id, adminId)).rejects.toThrow('manual settlement');
    expect(repository.transition).not.toHaveBeenCalled();
  });
});
