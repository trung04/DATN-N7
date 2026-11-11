import { BookingStatus } from '../../bookings/entities/booking.entity';

export class ReportCurrencySummary {
  currency: string;
  paidBookingCount: number;
  paidAmount: number;
  pendingSettlementBookingCount: number;
  pendingSettlementAmount: number;
  refundedBookingCount: number;
  refundAmount: number;
  settledBookingCount: number;
  settlementBaseAmount: number;
  commissionAmount: number;
  partnerReceivableAmount: number;
}

export class ReportHotelSummary extends ReportCurrencySummary {
  hotelId: string;
  hotelName: string;
  bookingCount: number;
}

export class ReportSummaryResponse {
  from: string;
  to: string;
  bookingCount: number;
  bookingStatusCounts: Record<BookingStatus, number>;
  financialByCurrency: ReportCurrencySummary[];
  hotels: ReportHotelSummary[];
}

export class ReportBookingTrendPoint {
  period: string;
  bookingCount: number;
  statusCounts: Record<BookingStatus, number>;
}

export class ReportFinancialTrendPoint {
  period: string;
  currency: string;
  paidAmount: number;
  refundAmount: number;
  settlementBaseAmount: number;
  commissionAmount: number;
  partnerReceivableAmount: number;
}

export class ReportTimeseriesResponse {
  groupBy: string;
  bookingTrend: ReportBookingTrendPoint[];
  financialTrend: ReportFinancialTrendPoint[];
}

