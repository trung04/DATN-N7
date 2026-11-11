import {
  BookingListResponse,
  BookingResponse,
} from '../dtos/responses/booking.response';
import { BookingEntity } from '../entities/booking.entity';

export class BookingMapper {
  static toResponse(booking: BookingEntity): BookingResponse {
    return {
      id: booking.id,
      hotelId: booking.hotelId,
      touristId: booking.touristId,
      bookingCode: booking.bookingCode,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      adultCount: booking.adultCount,
      childCount: booking.childCount,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      specialRequests: booking.specialRequests,
      bookingStatus: booking.bookingStatus,
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
      reservationExpiresAt: booking.reservationExpiresAt.toISOString(),
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      appliedCommissionRate: booking.appliedCommissionRate,
      amount: booking.amount,
      paymentMethod: booking.paymentMethod,
      paymentCreatedAt: booking.paymentCreatedAt?.toISOString() ?? null,
      paymentExpiresAt: booking.paymentExpiresAt?.toISOString() ?? null,
      paymentStatus: booking.paymentStatus,
      paidAt: booking.paidAt?.toISOString() ?? null,
      paymentTransactionId: booking.paymentTransactionId,
      settlementBaseAmount: booking.settlementBaseAmount,
      commissionAmount: booking.commissionAmount,
      partnerReceivableAmount: booking.partnerReceivableAmount,
      settlementStatus: booking.settlementStatus,
      transactionId: booking.transactionId,
      bankNameSnapshot: booking.bankNameSnapshot,
      bankAccountNumberSnapshot: booking.bankAccountNumberSnapshot,
      bankAccountHolderSnapshot: booking.bankAccountHolderSnapshot,
      settledAt: booking.settledAt?.toISOString() ?? null,
      cancellationPolicyId: booking.cancellationPolicyId,
      cancellationWindowSnapshot: booking.cancellationWindowSnapshot,
      cancellationFeeRateSnapshot: booking.cancellationFeeRateSnapshot,
      cancellationDescriptionSnapshot: booking.cancellationDescriptionSnapshot,
      cancellationFeeAmount: booking.cancellationFeeAmount,
      refundAmount: booking.refundAmount,
      refundReason: booking.refundReason,
      refundStatus: booking.refundStatus,
      refundedAt: booking.refundedAt?.toISOString() ?? null,
      refundTransactionId: booking.refundTransactionId,
      roomItems: (booking.roomItems ?? []).map((item) => ({
        id: item.id,
        roomId: item.roomId,
        roomNumberSnapshot: item.roomNumberSnapshot,
        roomTypeSnapshot: item.roomTypeSnapshot,
        maxOccupancySnapshot: item.maxOccupancySnapshot,
        pricePerNight: item.pricePerNight,
        currency: item.currency,
        numberOfNights: item.numberOfNights,
        subtotal: item.subtotal,
      })),
    };
  }

  static toListResponse(
    bookings: BookingEntity[],
    page: number,
    limit: number,
    total: number,
  ): BookingListResponse {
    return {
      data: bookings.map((booking) => this.toResponse(booking)),
      meta: { page, limit, total },
    };
  }
}
