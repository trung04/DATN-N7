import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  SettlementStatus,
} from '../../entities/booking.entity';
import type { BookingCancellationPolicySnapshot } from '../../entities/booking.entity';

export class BookingRoomResponse {
  id: string;
  roomId: string;
  roomNumberSnapshot: string;
  roomTypeSnapshot: string;
  maxOccupancySnapshot: number;
  pricePerNight: number;
  currency: string;
  numberOfNights: number;
  subtotal: number;
}

export class BookingResponse {
  id: string;
  hotelId: string;
  touristId: string;
  bookingCode: string;
  createdAt: string;
  updatedAt: string;
  checkInDate: string;
  checkOutDate: string;
  adultCount: number;
  childCount: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  specialRequests: string | null;
  bookingStatus: BookingStatus;
  cancelledAt: string | null;
  reservationExpiresAt: string;
  totalAmount: number;
  currency: string;
  appliedCommissionRate: number;
  amount: number;
  paymentMethod: PaymentMethod | null;
  paymentCreatedAt: string | null;
  paymentExpiresAt: string | null;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  paymentTransactionId: string | null;
  settlementBaseAmount: number | null;
  commissionAmount: number | null;
  partnerReceivableAmount: number | null;
  settlementStatus: SettlementStatus;
  transactionId: string | null;
  bankNameSnapshot: string | null;
  bankAccountNumberSnapshot: string | null;
  bankAccountHolderSnapshot: string | null;
  settledAt: string | null;
  cancellationPolicyId: string | null;
  cancellationPolicySnapshot: BookingCancellationPolicySnapshot | null;
  cancellationAllowedNow: boolean;
  cancellationUnavailableReason: string | null;
  cancellationFeeAmountNow: number | null;
  cancellationWindowSnapshot: number | null;
  cancellationFeeRateSnapshot: number | null;
  cancellationDescriptionSnapshot: string | null;
  cancellationFeeAmount: number | null;
  refundAmount: number | null;
  refundReason: string | null;
  refundStatus: RefundStatus;
  refundRequestedAt: string | null;
  refundProcessingAt: string | null;
  refundAttempt: number;
  refundFailureReason: string | null;
  refundFailedAt: string | null;
  refundedAt: string | null;
  refundTransactionId: string | null;
  roomItems: BookingRoomResponse[];
}

export class BookingListResponse {
  data: BookingResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
