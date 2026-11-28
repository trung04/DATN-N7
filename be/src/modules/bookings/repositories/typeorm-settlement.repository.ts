import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  BookingEntity,
  BookingStatus,
  PaymentProvider,
  PaymentStatus,
  RefundStatus,
  SettlementStatus,
} from '../entities/booking.entity';
import { SettlementBatchEntity, SettlementBatchStatus, SettlementTransferMode } from '../entities/settlement-batch.entity';
import { SettlementItemEntity } from '../entities/settlement-item.entity';
import { SettlementBatchEventEntity } from '../entities/settlement-batch-event.entity';
import type {
  SettlementBatchData,
  SettlementBatchWithItems,
  SettlementItemData,
  SettlementRepository,
  SettlementTransition,
} from '../interfaces/settlement.repository.interface';

@Injectable()
export class TypeOrmSettlementRepository implements SettlementRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SettlementBatchEntity)
    private readonly batches: Repository<SettlementBatchEntity>,
  ) {}

  countLivePayments(bookingIds: string[]): Promise<number> {
    return this.dataSource.getRepository(BookingEntity).countBy({
      id: In(bookingIds),
      paymentProvider: In([PaymentProvider.LEGACY_LIVE, PaymentProvider.PAYOS]),
    });
  }

  findEligibleBookings(
    hotelId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<BookingEntity[]> {
    return this.dataSource
      .getRepository(BookingEntity)
      .createQueryBuilder('booking')
      .where('booking.hotelId = :hotelId', { hotelId })
      .andWhere('booking.checkOutDate BETWEEN :periodStart AND :periodEnd', {
        periodStart,
        periodEnd,
      })
      .andWhere('booking.bookingStatus = :bookingStatus', {
        bookingStatus: BookingStatus.COMPLETED,
      })
      .andWhere('booking.paymentStatus = :paymentStatus', {
        paymentStatus: PaymentStatus.PAID,
      })
      .andWhere('booking.settlementStatus = :settlementStatus', {
        settlementStatus: SettlementStatus.PENDING,
      })
      .andWhere('booking.refundStatus = :refundStatus', {
        refundStatus: RefundStatus.NONE,
      })
      .andWhere('booking.paymentProvider IN (:...providers)', { providers: [PaymentProvider.LEGACY_LIVE, PaymentProvider.PAYOS] })
      .orderBy('booking.checkOutDate', 'ASC')
      .addOrderBy('booking.bookingCode', 'ASC')
      .getMany();
  }

  async createBatch(
    data: SettlementBatchData,
    itemData: SettlementItemData[],
  ): Promise<SettlementBatchWithItems> {
    return this.dataSource.transaction(async (manager) => {
      const bookingRepository = manager.getRepository(BookingEntity);
      const ids = itemData.map((item) => item.bookingId);
      const locked = await bookingRepository
        .createQueryBuilder('booking')
        .setLock('pessimistic_write')
        .where('booking.id IN (:...ids)', { ids })
        .andWhere('booking.hotelId = :hotelId', { hotelId: data.hotelId })
        .andWhere('booking.checkOutDate BETWEEN :periodStart AND :periodEnd', {
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
        })
        .andWhere('booking.bookingStatus = :bookingStatus', {
          bookingStatus: BookingStatus.COMPLETED,
        })
        .andWhere('booking.paymentStatus = :paymentStatus', {
          paymentStatus: PaymentStatus.PAID,
        })
        .andWhere('booking.settlementStatus = :settlementStatus', {
          settlementStatus: SettlementStatus.PENDING,
        })
        .andWhere('booking.refundStatus = :refundStatus', {
          refundStatus: RefundStatus.NONE,
        })
        .andWhere('booking.paymentProvider IN (:...providers)', { providers: [PaymentProvider.LEGACY_LIVE, PaymentProvider.PAYOS] })
        .getMany();
      if (locked.length !== ids.length) {
        throw new ConflictException(
          'Booking eligibility changed while the settlement batch was being created. Refresh and retry.',
        );
      }
      const batchRepository = manager.getRepository(SettlementBatchEntity);
      const { createdBy, ...batchData } = data;
      const batch = await batchRepository.save(batchRepository.create(batchData));
      const items = itemData.map((item) =>
        manager.getRepository(SettlementItemEntity).create({
          ...item,
          settlementBatchId: batch.id,
        }),
      );
      await manager.getRepository(SettlementItemEntity).save(items);
      const event = await manager.getRepository(SettlementBatchEventEntity).save(
        manager.getRepository(SettlementBatchEventEntity).create({
          settlementBatchId: batch.id,
          fromStatus: null,
          toStatus: batch.status,
          actorUserId: createdBy,
          note: 'Kỳ đối soát được tạo từ booking đủ điều kiện.',
          transferReference: null,
        }),
      );
      return { ...batch, items, events: [event] };
    });
  }

  async findPage(filters: {
    hotelId?: string;
    status?: string;
    ownerUserId?: string;
  }): Promise<SettlementBatchWithItems[]> {
    const query = this.batches.createQueryBuilder('batch');
    if (filters.hotelId) {
      query.andWhere('batch.hotelId = :hotelId', { hotelId: filters.hotelId });
    }
    if (filters.status) {
      query.andWhere('batch.status = :status', { status: filters.status });
    }
    if (filters.ownerUserId) {
      query.andWhere('batch.ownerUserId = :ownerUserId', {
        ownerUserId: filters.ownerUserId,
      });
      query.andWhere('batch.status <> :draft', { draft: SettlementBatchStatus.DRAFT });
      query.orderBy('batch.periodEnd', 'DESC').addOrderBy('batch.periodStart', 'DESC');
    }
    const batches = await query
      .addOrderBy('batch.createdAt', 'DESC')
      .addOrderBy('batch.id', 'DESC')
      .getMany();
    if (batches.length === 0) return [];
    const items = await this.dataSource
      .getRepository(SettlementItemEntity)
      .find({
        where: { settlementBatchId: In(batches.map((batch) => batch.id)) },
        order: { checkOutDateSnapshot: 'ASC' },
      });
    const events = await this.dataSource
      .getRepository(SettlementBatchEventEntity)
      .find({
        where: { settlementBatchId: In(batches.map((batch) => batch.id)) },
        order: { createdAt: 'ASC' },
      });
    return batches.map((batch) => ({
      ...batch,
      items: items.filter((item) => item.settlementBatchId === batch.id),
      events: events.filter((event) => event.settlementBatchId === batch.id),
    }));
  }

  async findById(id: string): Promise<SettlementBatchWithItems | null> {
    const batch = await this.batches.findOneBy({ id });
    if (!batch) return null;
    const items = await this.dataSource
      .getRepository(SettlementItemEntity)
      .find({
        where: { settlementBatchId: id },
        order: { checkOutDateSnapshot: 'ASC' },
      });
    const events = await this.dataSource
      .getRepository(SettlementBatchEventEntity)
      .find({ where: { settlementBatchId: id }, order: { createdAt: 'ASC' } });
    return { ...batch, items, events };
  }

  async findDuePayosPayoutIds(checkBefore: Date, limit: number): Promise<string[]> {
    const rows = await this.batches.createQueryBuilder('batch')
      .select('batch.id')
      .where('batch.transferMode = :mode AND batch.status = :status', {
        mode: SettlementTransferMode.PAYOS, status: SettlementBatchStatus.PROCESSING,
      })
      .andWhere('(batch.payoutSubmittedAt IS NULL OR batch.updatedAt <= :checkBefore)', { checkBefore })
      .orderBy('batch.updatedAt', 'ASC')
      .addOrderBy('batch.id', 'ASC')
      .take(limit)
      .getMany();
    return rows.map((row) => row.id);
  }

  async claimPayosPayoutCheck(id: string, requestId: string, submit: boolean, checkBefore: Date): Promise<boolean> {
    const now = new Date();
    const result = await this.batches.createQueryBuilder().update(SettlementBatchEntity)
      .set(submit ? { payoutSubmittedAt: now, updatedAt: now } : { updatedAt: now })
      .where('id = :id AND payout_request_id = :requestId AND transfer_mode = :mode AND status = :status', {
        id, requestId, mode: SettlementTransferMode.PAYOS, status: SettlementBatchStatus.PROCESSING,
      })
      .andWhere(submit ? 'payout_submitted_at IS NULL' : 'payout_submitted_at IS NOT NULL AND updated_at <= :checkBefore', { checkBefore })
      .execute();
    return result.affected === 1;
  }

  async transition(input: SettlementTransition): Promise<SettlementBatchWithItems | null> {
    return this.dataSource.transaction(async (manager) => {
      const batchRepository = manager.getRepository(SettlementBatchEntity);
      const batch = await batchRepository
        .createQueryBuilder('batch')
        .setLock('pessimistic_write')
        .where('batch.id = :id', { id: input.id })
        .getOne();
      if (!batch) return null;
      if (batch.status !== input.expectedStatus ||
          (input.expectedRevision !== undefined && batch.revision !== input.expectedRevision)) {
        throw new ConflictException(
          'Settlement status changed. Reload the batch before continuing.',
        );
      }

      const itemRepository = manager.getRepository(SettlementItemEntity);
      const items = await itemRepository.find({
        where: { settlementBatchId: batch.id },
      });
      const bookings = items.length === 0 ? [] : await manager
        .getRepository(BookingEntity)
        .createQueryBuilder('booking')
        .setLock('pessimistic_write')
        .where('booking.id IN (:...ids)', {
          ids: items.map((item) => item.bookingId),
        })
        .getMany();

      if (input.nextStatus === 'PROCESSING') {
        if (
          items.length === 0 || bookings.length !== items.length ||
          bookings.some(
            (booking) =>
              booking.bookingStatus !== BookingStatus.COMPLETED ||
              booking.paymentStatus !== PaymentStatus.PAID ||
              booking.refundStatus !== RefundStatus.NONE ||
              (booking.paymentProvider !== PaymentProvider.LEGACY_LIVE && booking.paymentProvider !== PaymentProvider.PAYOS) ||
              ![SettlementStatus.PENDING, SettlementStatus.PROCESSING].includes(
                booking.settlementStatus,
              ),
          )
        ) {
          throw new ConflictException(
            'One or more bookings are no longer eligible for payout.',
          );
        }
        for (const booking of bookings) {
          booking.settlementStatus = SettlementStatus.PROCESSING;
        }
        await manager.getRepository(BookingEntity).save(bookings);
        batch.processingAt = new Date();
        batch.failedAt = null;
        batch.failureReason = null;
        batch.transferMode = (input.transferMode ?? batch.transferMode) as SettlementBatchEntity['transferMode'];
        if (input.payoutRequestId && input.payoutBankBin) {
          batch.payoutRequestId = input.payoutRequestId;
          batch.payoutBankBin = input.payoutBankBin;
          batch.payoutSubmittedAt = null;
        }
      }

      if (input.nextStatus === 'PAID') {
        if (
          !input.transferReference ||
          bookings.length !== items.length ||
          bookings.some(
            (booking) =>
              booking.bookingStatus !== BookingStatus.COMPLETED ||
              booking.paymentStatus !== PaymentStatus.PAID ||
              booking.refundStatus !== RefundStatus.NONE ||
              booking.settlementStatus !== SettlementStatus.PROCESSING,
          )
        ) {
          throw new ConflictException(
            'Cannot record payout: verify the transfer reference and current booking states.',
          );
        }
        const byId = new Map(items.map((item) => [item.bookingId, item]));
        for (const booking of bookings) {
          const item = byId.get(booking.id)!;
          booking.settlementBaseAmount = Number(item.grossAmount);
          booking.commissionAmount = Number(item.commissionAmount);
          booking.partnerReceivableAmount = Number(item.netAmount);
          booking.settlementStatus = SettlementStatus.SETTLED;
          booking.transactionId = input.transferReference;
          booking.bankNameSnapshot = batch.bankNameSnapshot;
          booking.bankAccountNumberSnapshot = batch.bankAccountNumberSnapshot;
          booking.bankAccountHolderSnapshot = batch.bankAccountHolderSnapshot;
          booking.settledAt = new Date();
        }
        await manager.getRepository(BookingEntity).save(bookings);
        batch.transferReference = input.transferReference;
        batch.transferMode = (input.transferMode ?? batch.transferMode) as SettlementBatchEntity['transferMode'];
        batch.providerTransferId = input.providerTransferId ?? null;
        batch.paidAt = new Date();
      }

      if (input.nextStatus === 'FAILED') {
        batch.failedAt = new Date();
        batch.failureReason = input.failureReason ?? null;
      }
      if (input.approvedBy) {
        batch.approvedBy = input.approvedBy;
        batch.approvedAt = new Date();
      }
      const fromStatus = batch.status;
      batch.revision += 1;
      batch.status = input.nextStatus as SettlementBatchEntity['status'];
      const saved = await batchRepository.save(batch);
      const note = input.nextStatus === 'FAILED'
        ? input.failureReason ?? 'Giao dịch chuyển khoản thất bại.'
        : input.nextStatus === 'PAID'
          ? 'Admin ghi nhận ngân hàng đã chuyển khoản thành công.'
          : input.nextStatus === 'PROCESSING'
            ? 'Kỳ đối soát được mở để thực hiện chuyển khoản tại ngân hàng.'
            : 'Bảng kê được admin phê duyệt.';
      const event = await manager.getRepository(SettlementBatchEventEntity).save(
        manager.getRepository(SettlementBatchEventEntity).create({
          settlementBatchId: batch.id,
          fromStatus,
          toStatus: input.nextStatus,
          actorUserId: input.actorUserId,
          note: input.eventNote ?? note,
          transferReference: input.transferReference ?? null,
        }),
      );
      const events = await manager.getRepository(SettlementBatchEventEntity).find({
        where: { settlementBatchId: batch.id },
        order: { createdAt: 'ASC' },
      });
      return { ...saved, items, events: [...events.filter((row) => row.id !== event.id), event] };
    });
  }
}
