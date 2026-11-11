import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import {
  BookingEntity,
  BookingStatus,
  PaymentStatus,
  RefundStatus,
  SettlementStatus,
} from '../../bookings/entities/booking.entity';
import { HotelsService } from '../../hotels/services/hotels.service';
import { UserRole } from '../../users/entities/user.entity';
import { ReportQueryRequest, ReportGroupBy } from '../dtos/report-query.request';
import {
  ReportCurrencySummary,
  ReportFinancialTrendPoint,
  ReportHotelSummary,
  ReportSummaryResponse,
  ReportTimeseriesResponse,
} from '../dtos/report.response';

interface CountRow { status: BookingStatus; count: string }
interface CurrencyRow {
  currency: string;
  count?: string;
  amount?: string;
  pendingSettlementAmount?: string;
  refundAmount?: string;
  settlementBaseAmount?: string;
  commissionAmount?: string;
  partnerReceivableAmount?: string;
}
interface HotelRow extends CurrencyRow { hotelId: string; hotelName: string }
interface TrendRow extends CurrencyRow { period: string; status?: BookingStatus }

const bookingStatuses = Object.values(BookingStatus);

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(BookingEntity)
    private readonly bookings: Repository<BookingEntity>,
    private readonly hotelsService: HotelsService,
  ) {}

  async summary(input: ReportQueryRequest, actor: AuthorizationActor): Promise<ReportSummaryResponse> {
    await this.assertScope(input, actor);
    this.validateRange(input);
    const bookingQuery = this.rangeQuery('booking.createdAt', input, actor);
    const statusRows = await bookingQuery
      .clone()
      .select('booking.bookingStatus', 'status')
      .addSelect('COUNT(booking.id)', 'count')
      .groupBy('booking.bookingStatus')
      .getRawMany<CountRow>();
    const bookingStatusCounts = this.emptyStatusCounts();
    for (const row of statusRows) bookingStatusCounts[row.status] = Number(row.count);

    const pendingSettlementCondition = 'booking.paymentStatus = :paymentStatus AND booking.settlementStatus IN (:...settlementStatuses)';
    const pendingSettlementParams = { paymentStatus: PaymentStatus.PAID, settlementStatuses: [SettlementStatus.PENDING, SettlementStatus.PROCESSING] };
    const [paidRows, refundRows, settlementRows, pendingRows, hotelBookings, hotelPaid, hotelRefunds, hotelSettlements, hotelPending] = await Promise.all([
      this.financialRows(input, actor, 'paidAt', 'booking.paymentStatus = :status', { status: PaymentStatus.PAID },
        'SUM(booking.amount)', 'amount'),
      this.financialRows(input, actor, 'refundedAt', 'booking.refundStatus = :status', { status: RefundStatus.REFUNDED },
        'SUM(COALESCE(booking.refundAmount, 0))', 'refundAmount'),
      this.settlementRows(input, actor),
      this.financialRows(input, actor, 'paidAt', pendingSettlementCondition, pendingSettlementParams,
        'SUM(booking.amount)', 'pendingSettlementAmount'),
      this.hotelBookingRows(input, actor),
      this.financialRows(input, actor, 'paidAt', 'booking.paymentStatus = :status', { status: PaymentStatus.PAID },
        'SUM(booking.amount)', 'amount', true),
      this.financialRows(input, actor, 'refundedAt', 'booking.refundStatus = :status', { status: RefundStatus.REFUNDED },
        'SUM(COALESCE(booking.refundAmount, 0))', 'refundAmount', true),
      this.settlementRows(input, actor, true),
      this.financialRows(input, actor, 'paidAt', pendingSettlementCondition, pendingSettlementParams,
        'SUM(booking.amount)', 'pendingSettlementAmount', true),
    ]);

    const financialByCurrency = this.mergeCurrencyRows(
      [paidRows, 'paid'], [pendingRows, 'pending'], [refundRows, 'refund'], [settlementRows, 'settlement'],
    );
    const hotelMap = new Map<string, ReportHotelSummary>();
    for (const row of hotelBookings) {
      const key = `${row.hotelId}:${row.currency}`;
      hotelMap.set(key, {
        hotelId: row.hotelId,
        hotelName: row.hotelName,
        currency: row.currency,
        bookingCount: Number(row.count ?? 0),
        paidBookingCount: 0,
        paidAmount: 0,
        pendingSettlementBookingCount: 0,
        pendingSettlementAmount: 0,
        refundedBookingCount: 0,
        refundAmount: 0,
        settledBookingCount: 0,
        settlementBaseAmount: 0,
        commissionAmount: 0,
        partnerReceivableAmount: 0,
      });
    }
    this.mergeHotelRows(hotelMap, hotelPaid, 'paid');
    this.mergeHotelRows(hotelMap, hotelRefunds, 'refund');
    this.mergeHotelRows(hotelMap, hotelSettlements, 'settlement');
    this.mergeHotelRows(hotelMap, hotelPending, 'pending');

    return {
      from: input.from,
      to: input.to,
      bookingCount: statusRows.reduce((sum, row) => sum + Number(row.count), 0),
      bookingStatusCounts,
      financialByCurrency,
      hotels: [...hotelMap.values()].sort((a, b) => a.hotelName.localeCompare(b.hotelName, 'vi') || a.currency.localeCompare(b.currency)),
    };
  }

  async timeseries(input: ReportQueryRequest, actor: AuthorizationActor): Promise<ReportTimeseriesResponse> {
    await this.assertScope(input, actor);
    this.validateRange(input);
    const periodExpression = this.periodExpression(input.groupBy ?? ReportGroupBy.DAY, 'created_at');
    const bookingRows = await this.rangeQuery('booking.createdAt', input, actor)
      .select(periodExpression, 'period')
      .addSelect('booking.bookingStatus', 'status')
      .addSelect('COUNT(booking.id)', 'count')
      .groupBy('period')
      .addGroupBy('booking.bookingStatus')
      .orderBy('period', 'ASC')
      .getRawMany<TrendRow>();
    const bookingMap = new Map<string, { period: string; bookingCount: number; statusCounts: Record<BookingStatus, number> }>();
    for (const row of bookingRows) {
      const point = bookingMap.get(row.period) ?? { period: row.period, bookingCount: 0, statusCounts: this.emptyStatusCounts() };
      const count = Number(row.count ?? 0);
      point.bookingCount += count;
      point.statusCounts[row.status!] = count;
      bookingMap.set(row.period, point);
    }

    const [paidRows, refundRows, settlementRows] = await Promise.all([
      this.trendFinancialRows(input, actor, this.periodExpression(input.groupBy ?? ReportGroupBy.DAY, 'paid_at'), 'paidAt', 'booking.paymentStatus = :status', { status: PaymentStatus.PAID },
        'SUM(booking.amount)', 'amount'),
      this.trendFinancialRows(input, actor, this.periodExpression(input.groupBy ?? ReportGroupBy.DAY, 'refunded_at'), 'refundedAt', 'booking.refundStatus = :status', { status: RefundStatus.REFUNDED },
        'SUM(COALESCE(booking.refundAmount, 0))', 'refundAmount'),
      this.trendSettlementRows(input, actor, this.periodExpression(input.groupBy ?? ReportGroupBy.DAY, 'settled_at')),
    ]);
    const financeMap = new Map<string, ReportFinancialTrendPoint>();
    for (const row of paidRows) this.mergeTrendRow(financeMap, row, 'paid');
    for (const row of refundRows) this.mergeTrendRow(financeMap, row, 'refund');
    for (const row of settlementRows) this.mergeTrendRow(financeMap, row, 'settlement');
    return {
      groupBy: input.groupBy ?? ReportGroupBy.DAY,
      bookingTrend: [...bookingMap.values()].sort((a, b) => a.period.localeCompare(b.period)),
      financialTrend: [...financeMap.values()].sort((a, b) => a.period.localeCompare(b.period) || a.currency.localeCompare(b.currency)),
    };
  }

  private async assertScope(input: ReportQueryRequest, actor: AuthorizationActor): Promise<void> {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.HOTEL_OWNER) {
      throw new AuthorizationDeniedException();
    }
    if (actor.role === UserRole.HOTEL_OWNER) {
      if (!input.hotelId) throw new AuthorizationDeniedException();
      await this.hotelsService.assertManagedBy(input.hotelId, actor);
    }
    if (actor.role === UserRole.ADMIN && input.hotelId) {
      // The hotel filter is UUID-validated by the request DTO; a missing match naturally returns no rows.
    }
  }

  private validateRange(input: ReportQueryRequest): void {
    if (input.from > input.to) throw new BadRequestException('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  }

  private rangeQuery(
    dateField: string,
    input: ReportQueryRequest,
    actor: AuthorizationActor,
  ): SelectQueryBuilder<BookingEntity> {
    const query = this.bookings.createQueryBuilder('booking')
      .andWhere(`${dateField} BETWEEN :from AND :to`, {
        from: this.startOfDay(input.from),
        to: this.endOfDay(input.to),
      });
    if (input.hotelId) query.andWhere('booking.hotelId = :hotelId', { hotelId: input.hotelId });
    if (actor.role === UserRole.HOTEL_OWNER) query.andWhere('booking.hotelId = :managedHotelId', { managedHotelId: input.hotelId });
    return query;
  }

  private async financialRows(
    input: ReportQueryRequest,
    actor: AuthorizationActor,
    field: string,
    condition: string,
    parameters: Record<string, unknown>,
    sumExpression: string,
    alias: string,
    byHotel = false,
  ): Promise<Array<CurrencyRow & Partial<HotelRow>>> {
    const query = this.rangeQuery(`booking.${field}`, input, actor)
      .andWhere(condition, parameters)
      .select('booking.currency', 'currency')
      .addSelect('COUNT(booking.id)', 'count')
      .addSelect(sumExpression, alias)
      .groupBy('booking.currency');
    if (byHotel) {
      query.leftJoin('hotels', 'reportHotel', 'reportHotel.id = booking.hotel_id')
        .addSelect('booking.hotelId', 'hotelId')
        .addSelect('reportHotel.name', 'hotelName')
        .addGroupBy('booking.hotelId')
        .addGroupBy('reportHotel.name');
    }
    return query.getRawMany<CurrencyRow & Partial<HotelRow>>();
  }

  private async settlementRows(
    input: ReportQueryRequest,
    actor: AuthorizationActor,
    byHotel = false,
  ): Promise<Array<CurrencyRow & Partial<HotelRow>>> {
    const query = this.rangeQuery('booking.settledAt', input, actor)
      .andWhere('booking.settlementStatus = :status', { status: SettlementStatus.SETTLED })
      .select('booking.currency', 'currency')
      .addSelect('COUNT(booking.id)', 'count')
      .addSelect('SUM(COALESCE(booking.settlementBaseAmount, 0))', 'settlementBaseAmount')
      .addSelect('SUM(COALESCE(booking.commissionAmount, 0))', 'commissionAmount')
      .addSelect('SUM(COALESCE(booking.partnerReceivableAmount, 0))', 'partnerReceivableAmount')
      .groupBy('booking.currency');
    if (byHotel) {
      query.leftJoin('hotels', 'reportHotel', 'reportHotel.id = booking.hotel_id')
        .addSelect('booking.hotelId', 'hotelId')
        .addSelect('reportHotel.name', 'hotelName')
        .addGroupBy('booking.hotelId')
        .addGroupBy('reportHotel.name');
    }
    return query.getRawMany<CurrencyRow & Partial<HotelRow>>();
  }

  private async hotelBookingRows(input: ReportQueryRequest, actor: AuthorizationActor): Promise<HotelRow[]> {
    return this.rangeQuery('booking.createdAt', input, actor)
      .leftJoin('hotels', 'reportHotel', 'reportHotel.id = booking.hotel_id')
      .select('booking.hotelId', 'hotelId')
      .addSelect('reportHotel.name', 'hotelName')
      .addSelect('booking.currency', 'currency')
      .addSelect('COUNT(booking.id)', 'count')
      .groupBy('booking.hotelId')
      .addGroupBy('reportHotel.name')
      .addGroupBy('booking.currency')
      .getRawMany<HotelRow>();
  }

  private async trendFinancialRows(
    input: ReportQueryRequest,
    actor: AuthorizationActor,
    periodExpression: string,
    field: string,
    condition: string,
    parameters: Record<string, unknown>,
    sumExpression: string,
    alias: string,
  ): Promise<TrendRow[]> {
    return this.rangeQuery(`booking.${field}`, input, actor)
      .andWhere(condition, parameters)
      .select(periodExpression, 'period')
      .addSelect('booking.currency', 'currency')
      .addSelect(sumExpression, alias)
      .groupBy('period')
      .addGroupBy('booking.currency')
      .orderBy('period', 'ASC')
      .getRawMany<TrendRow>();
  }

  private async trendSettlementRows(
    input: ReportQueryRequest,
    actor: AuthorizationActor,
    periodExpression: string,
  ): Promise<TrendRow[]> {
    return this.rangeQuery('booking.settledAt', input, actor)
      .andWhere('booking.settlementStatus = :status', { status: SettlementStatus.SETTLED })
      .select(periodExpression, 'period')
      .addSelect('booking.currency', 'currency')
      .addSelect('SUM(COALESCE(booking.settlementBaseAmount, 0))', 'settlementBaseAmount')
      .addSelect('SUM(COALESCE(booking.commissionAmount, 0))', 'commissionAmount')
      .addSelect('SUM(COALESCE(booking.partnerReceivableAmount, 0))', 'partnerReceivableAmount')
      .groupBy('period')
      .addGroupBy('booking.currency')
      .orderBy('period', 'ASC')
      .getRawMany<TrendRow>();
  }

  private mergeCurrencyRows(...groups: Array<[CurrencyRow[], 'paid' | 'pending' | 'refund' | 'settlement']>): ReportCurrencySummary[] {
    const map = new Map<string, ReportCurrencySummary>();
    for (const [rows, kind] of groups) for (const row of rows) {
      const item = map.get(row.currency) ?? {
        currency: row.currency, paidBookingCount: 0, paidAmount: 0, pendingSettlementBookingCount: 0,
        pendingSettlementAmount: 0, refundedBookingCount: 0,
        refundAmount: 0, settledBookingCount: 0, settlementBaseAmount: 0,
        commissionAmount: 0, partnerReceivableAmount: 0,
      };
      this.applyCurrencyRow(item, row, kind);
      map.set(row.currency, item);
    }
    return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  }

  private mergeHotelRows(map: Map<string, ReportHotelSummary>, rows: Array<CurrencyRow & Partial<HotelRow>>, kind: 'paid' | 'refund' | 'settlement' | 'pending'): void {
    for (const row of rows) {
      if (!row.hotelId) continue;
      const key = `${row.hotelId}:${row.currency}`;
      const item = map.get(key) ?? {
        hotelId: row.hotelId, hotelName: row.hotelName ?? row.hotelId, currency: row.currency, bookingCount: 0,
        paidBookingCount: 0, paidAmount: 0, pendingSettlementBookingCount: 0, pendingSettlementAmount: 0, refundedBookingCount: 0, refundAmount: 0,
        settledBookingCount: 0, settlementBaseAmount: 0, commissionAmount: 0, partnerReceivableAmount: 0,
      };
      this.applyCurrencyRow(item, row, kind);
      map.set(key, item);
    }
  }

  private applyCurrencyRow(
    item: ReportCurrencySummary,
    row: CurrencyRow,
    kind?: 'paid' | 'refund' | 'settlement' | 'pending',
  ): void {
    if (!kind || kind === 'paid') {
      item.paidBookingCount += Number(row.count ?? 0);
      item.paidAmount += Number(row.amount ?? 0);
    }
    if (!kind || kind === 'pending') {
      item.pendingSettlementBookingCount += Number(row.count ?? 0);
      item.pendingSettlementAmount += Number(row.pendingSettlementAmount ?? row.amount ?? 0);
    }
    if (!kind || kind === 'refund') {
      item.refundedBookingCount += Number(row.count ?? 0);
      item.refundAmount += Number(row.refundAmount ?? 0);
    }
    if (!kind || kind === 'settlement') {
      item.settledBookingCount += Number(row.count ?? 0);
      item.settlementBaseAmount += Number(row.settlementBaseAmount ?? 0);
      item.commissionAmount += Number(row.commissionAmount ?? 0);
      item.partnerReceivableAmount += Number(row.partnerReceivableAmount ?? 0);
    }
  }

  private mergeTrendRow(map: Map<string, ReportFinancialTrendPoint>, row: TrendRow, kind: 'paid' | 'refund' | 'settlement'): void {
    const key = `${row.period}:${row.currency}`;
    const point = map.get(key) ?? {
      period: row.period, currency: row.currency, paidAmount: 0, refundAmount: 0,
      settlementBaseAmount: 0, commissionAmount: 0, partnerReceivableAmount: 0,
    };
    if (kind === 'paid') point.paidAmount = Number(row.amount ?? 0);
    if (kind === 'refund') point.refundAmount = Number(row.refundAmount ?? 0);
    if (kind === 'settlement') {
      point.settlementBaseAmount = Number(row.settlementBaseAmount ?? 0);
      point.commissionAmount = Number(row.commissionAmount ?? 0);
      point.partnerReceivableAmount = Number(row.partnerReceivableAmount ?? 0);
    }
    map.set(key, point);
  }

  private emptyStatusCounts(): Record<BookingStatus, number> {
    return Object.fromEntries(bookingStatuses.map((status) => [status, 0])) as Record<BookingStatus, number>;
  }

  private periodExpression(groupBy: ReportGroupBy, column: string): string {
    const trunc = groupBy === ReportGroupBy.WEEK ? 'week' : groupBy === ReportGroupBy.MONTH ? 'month' : 'day';
    const format = groupBy === ReportGroupBy.MONTH ? 'YYYY-MM' : 'YYYY-MM-DD';
    return `to_char(date_trunc('${trunc}', booking.${column} AT TIME ZONE 'Asia/Bangkok'), '${format}')`;
  }

  private startOfDay(value: string): Date {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000+07:00`) : new Date(value);
  }

  private endOfDay(value: string): Date {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:59.999+07:00`) : new Date(value);
  }
}
