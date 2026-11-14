import {
  BookingEntity,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  SettlementStatus,
} from '../entities/booking.entity';
import type { BookingCancellationPolicySnapshot } from '../entities/booking.entity';
import { BookingRoomEntity } from '../entities/booking-room.entity';

export const BOOKING_REPOSITORY = Symbol('BOOKING_REPOSITORY');

export type BookingSortField =
  'createdAt' | 'bookingCode' | 'totalAmount' | 'amount';

export interface FindBookingsOptions {
  page: number;
  limit: number;
  search?: string;
  hotelId?: string;
  touristId?: string;
  bookingStatus?: BookingStatus;
  paymentStatus?: PaymentStatus;
  settlementStatus?: SettlementStatus;
  refundStatus?: RefundStatus;
  createdFrom?: string;
  createdTo?: string;
  sortBy: BookingSortField;
  sortOrder: 'ASC' | 'DESC';
}

export interface BookingPage {
  items: BookingEntity[];
  total: number;
}

export interface BookingIdempotencyData {
  key: string;
  requestHash: string;
  expiresAt: Date;
}

export interface CreatedBookingResult {
  booking: BookingEntity;
  replayed: boolean;
}

export interface CreateBookingData {
  hotelId: string;
  touristId: string;
  bookingCode: string;
  checkInDate: string;
  checkOutDate: string;
  adultCount: number;
  childCount: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  specialRequests: string | null;
  bookingStatus: BookingStatus;
  cancelledAt: Date | null;
  reservationExpiresAt: Date;
  totalAmount: number;
  currency: string;
  appliedCommissionRate: number;
  amount: number;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  settlementStatus: SettlementStatus;
  cancellationPolicyId: string | null;
  cancellationPolicySnapshot: BookingCancellationPolicySnapshot;
  cancellationWindowSnapshot: number | null;
  cancellationFeeRateSnapshot: number | null;
  cancellationDescriptionSnapshot: string | null;
  refundStatus: RefundStatus;
  refundRequestedAt: Date | null;
  refundProcessingAt: Date | null;
  refundAttempt: number;
  refundFailureReason: string | null;
  refundFailedAt: Date | null;
  refundHandledBy: string | null;
}

export type CreateBookingRoomData = Pick<
  BookingRoomEntity,
  | 'roomId'
  | 'roomNumberSnapshot'
  | 'roomTypeSnapshot'
  | 'maxOccupancySnapshot'
  | 'pricePerNight'
  | 'currency'
  | 'numberOfNights'
  | 'subtotal'
>;

export interface BookingRepository {
  findUnavailableRoomIds(
    hotelId: string | undefined,
    checkInDate: string,
    checkOutDate: string,
  ): Promise<string[]>;
  findById(id: string): Promise<BookingEntity | null>;
  findByCode(bookingCode: string): Promise<BookingEntity | null>;
  findBySePayOrderCode(orderCode: string): Promise<BookingEntity | null>;
  findByIdempotencyKey(
    key: string,
    requestHash: string,
  ): Promise<BookingEntity | null>;
  findPage(options: FindBookingsOptions): Promise<BookingPage>;
  create(
    data: CreateBookingData,
    roomItems: CreateBookingRoomData[],
    idempotency: BookingIdempotencyData,
  ): Promise<CreatedBookingResult>;
  save(booking: BookingEntity): Promise<BookingEntity>;
  withLockedById<T>(
    id: string,
    operation: (booking: BookingEntity) => Promise<T> | T,
  ): Promise<T | null>;
}
