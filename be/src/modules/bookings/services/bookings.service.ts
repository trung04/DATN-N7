import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { HotelsService } from '../../hotels/services/hotels.service';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { UserRole } from '../../users/entities/user.entity';
import { CancellationPoliciesService } from '../../cancellation-policies/services/cancellation-policies.service';
import { RoomOperationalStatus } from '../../rooms/entities/room.entity';
import { RoomsService } from '../../rooms/services/rooms.service';
import { CreateVnpayPaymentRequest } from '../dtos/requests/create-vnpay-payment.request';
import { CreateBookingRequest } from '../dtos/requests/create-booking.request';
import { ListBookingsRequest } from '../dtos/requests/list-bookings.request';
import { RefundBookingRequest } from '../dtos/requests/refund-booking.request';
import { SettleBookingRequest } from '../dtos/requests/settle-booking.request';
import { UpdateBookingRequest } from '../dtos/requests/update-booking.request';
import {
  VnpayIpnResponse,
  VnpayReturnResponse,
} from '../dtos/responses/vnpay-payment.response';
import {
  BookingEntity,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  SettlementStatus,
} from '../entities/booking.entity';
import {
  BookingActionNotAllowedException,
  BookingAlreadyPaidException,
  BookingAlreadySettledException,
  BookingNotFoundException,
  BookingPaymentAlreadyInitializedException,
  BookingPaymentRequiredException,
  BookingCapacityExceededException,
  BookingRoomNotOperationalException,
  BookingReservationExpiredException,
  BookingRoomsCurrencyMismatchException,
  BookingRoomsHotelMismatchException,
  BookingRefundAlreadyInitializedException,
  EmptyBookingUpdateException,
  InvalidBookingDateRangeException,
  InvalidBookingStayException,
  InvalidBookingFinancialTimestampException,
  InvalidBookingTransitionException,
  RefundAmountExceededException,
  SettlementBaseAmountExceededException,
  VnpayAmountNotSupportedException,
  VnpayCurrencyNotSupportedException,
} from '../exceptions/booking.exceptions';
import { BOOKING_CODE_GENERATOR } from '../interfaces/booking-code-generator.interface';
import type { BookingCodeGenerator } from '../interfaces/booking-code-generator.interface';
import { BOOKING_REPOSITORY } from '../interfaces/booking.repository.interface';
import type {
  BookingPage,
  BookingRepository,
  CreatedBookingResult,
} from '../interfaces/booking.repository.interface';
import { VNPAY_PAYMENT_GATEWAY } from '../interfaces/vnpay-payment-gateway.interface';
import type {
  VnpayPaymentGateway,
  VnpayRefundResult,
} from '../interfaces/vnpay-payment-gateway.interface';

export interface CreatedVnpayPayment {
  booking: BookingEntity;
  paymentUrl: string;
}

@Injectable()
export class BookingsService {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly repository: BookingRepository,
    @Inject(BOOKING_CODE_GENERATOR)
    private readonly codeGenerator: BookingCodeGenerator,
    @Inject(VNPAY_PAYMENT_GATEWAY)
    private readonly vnpayGateway: VnpayPaymentGateway,
    private readonly cancellationPoliciesService: CancellationPoliciesService,
    private readonly roomsService: RoomsService,
    private readonly configService: ConfigService,
    private readonly hotelsService: HotelsService,
  ) {}

  async create(
    touristId: string,
    input: CreateBookingRequest,
    idempotencyKey: string,
  ): Promise<CreatedBookingResult> {
    const requestHash = this.fingerprintCreateRequest(touristId, input);
    const replayedBooking = await this.repository.findByIdempotencyKey(
      idempotencyKey,
      requestHash,
    );
    if (replayedBooking) {
      return { booking: replayedBooking, replayed: true };
    }

    const rooms = await this.roomsService.findEntitiesByIds(input.roomIds);
    const hotelId = rooms[0].hotelId;
    await this.hotelsService.assertActive(hotelId);
    const currency = rooms[0].currency;
    if (rooms.some((room) => room.hotelId !== hotelId)) {
      throw new BookingRoomsHotelMismatchException();
    }
    if (rooms.some((room) => room.currency !== currency)) {
      throw new BookingRoomsCurrencyMismatchException();
    }
    const unavailableRoom = rooms.find(
      (room) => room.operationalStatus !== RoomOperationalStatus.AVAILABLE,
    );
    if (unavailableRoom) {
      throw new BookingRoomNotOperationalException(unavailableRoom.id);
    }
    const guestCount = input.adultCount + input.childCount;
    const totalCapacity = rooms.reduce(
      (total, room) => total + room.maxOccupancy,
      0,
    );
    if (guestCount > totalCapacity) {
      throw new BookingCapacityExceededException();
    }

    const numberOfNights = this.resolveNumberOfNights(
      input.checkInDate,
      input.checkOutDate,
    );
    const totalAmount = this.roundMoney(
      rooms.reduce(
        (total, room) => total + room.pricePerNight * numberOfNights,
        0,
      ),
    );
    const appliedCommissionRate = this.configService.getOrThrow<number>(
      'BOOKING_COMMISSION_RATE',
    );
    const holdMinutes = this.configService.getOrThrow<number>(
      'BOOKING_HOLD_MINUTES',
    );
    const idempotencyTtlHours = this.configService.getOrThrow<number>(
      'IDEMPOTENCY_KEY_TTL_HOURS',
    );

    return this.repository.create(
      {
        hotelId,
        touristId,
        bookingCode: this.codeGenerator.generate(),
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        adultCount: input.adultCount,
        childCount: input.childCount,
        guestName: input.guestName.trim(),
        guestEmail: input.guestEmail.trim().toLowerCase(),
        guestPhone: input.guestPhone.trim(),
        specialRequests: this.normalizeNullable(input.specialRequests),
        bookingStatus: BookingStatus.PENDING,
        cancelledAt: null,
        reservationExpiresAt: new Date(Date.now() + holdMinutes * 60_000),
        totalAmount,
        currency,
        appliedCommissionRate,
        amount: totalAmount,
        paymentMethod: null,
        paymentStatus: PaymentStatus.PENDING,
        settlementStatus: SettlementStatus.PENDING,
        cancellationPolicyId: null,
        cancellationWindowSnapshot: null,
        cancellationFeeRateSnapshot: null,
        cancellationDescriptionSnapshot: null,
        refundStatus: RefundStatus.NONE,
      },
      rooms.map((room) => ({
        roomId: room.id,
        roomNumberSnapshot: room.roomNumber,
        roomTypeSnapshot: room.roomType,
        maxOccupancySnapshot: room.maxOccupancy,
        pricePerNight: room.pricePerNight,
        currency: room.currency,
        numberOfNights,
        subtotal: this.roundMoney(room.pricePerNight * numberOfNights),
      })),
      {
        key: idempotencyKey,
        requestHash,
        expiresAt: new Date(Date.now() + idempotencyTtlHours * 3_600_000),
      },
    );
  }

  private fingerprintCreateRequest(
    touristId: string,
    input: CreateBookingRequest,
  ): string {
    const canonicalRequest = {
      touristId,
      roomIds: [...input.roomIds].sort(),
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      adultCount: input.adultCount,
      childCount: input.childCount,
      guestName: input.guestName.trim(),
      guestEmail: input.guestEmail.trim().toLowerCase(),
      guestPhone: input.guestPhone.trim(),
      specialRequests: this.normalizeNullable(input.specialRequests),
    };
    return createHash('sha256')
      .update(JSON.stringify(canonicalRequest))
      .digest('hex');
  }

  findPage(input: ListBookingsRequest): Promise<BookingPage> {
    if (
      input.createdFrom &&
      input.createdTo &&
      new Date(input.createdFrom) > new Date(input.createdTo)
    ) {
      throw new InvalidBookingDateRangeException();
    }
    return this.repository.findPage({
      page: input.page,
      limit: input.limit,
      search: input.search,
      hotelId: input.hotelId,
      touristId: input.touristId,
      bookingStatus: input.bookingStatus,
      paymentStatus: input.paymentStatus,
      settlementStatus: input.settlementStatus,
      refundStatus: input.refundStatus,
      createdFrom: input.createdFrom,
      createdTo: input.createdTo,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
  }

  async findPageForActor(
    input: ListBookingsRequest,
    actor: AuthorizationActor,
  ): Promise<BookingPage> {
    if (actor.role === UserRole.ADMIN) return this.findPage(input);

    if (actor.role === UserRole.HOTEL_OWNER && input.hotelId) {
      await this.hotelsService.assertManagedBy(input.hotelId, actor);
      const scoped = Object.assign(new ListBookingsRequest(), input);
      scoped.touristId = undefined;
      return this.findPage(scoped);
    }

    const scoped = Object.assign(new ListBookingsRequest(), input);
    scoped.hotelId = undefined;
    scoped.touristId = actor.id;
    return this.findPage(scoped);
  }

  async findById(id: string): Promise<BookingEntity> {
    const booking = await this.repository.findById(id);
    if (!booking) throw new BookingNotFoundException(id);
    return booking;
  }

  async findByIdForActor(
    id: string,
    actor: AuthorizationActor,
  ): Promise<BookingEntity> {
    const booking = await this.findById(id);
    await this.assertCanView(booking, actor);
    return booking;
  }

  async update(
    id: string,
    input: UpdateBookingRequest,
  ): Promise<BookingEntity> {
    if (this.isEmptyUpdate(input)) throw new EmptyBookingUpdateException();
    const booking = await this.findById(id);

    if (input.bookingStatus !== undefined) {
      this.assertBookingTransition(booking, input.bookingStatus);
      booking.bookingStatus = input.bookingStatus;
      if (input.bookingStatus === BookingStatus.CANCELLED) {
        booking.cancelledAt ??= new Date();
      }
    }
    if (input.adultCount !== undefined) booking.adultCount = input.adultCount;
    if (input.childCount !== undefined) booking.childCount = input.childCount;
    if (input.adultCount !== undefined || input.childCount !== undefined) {
      const totalCapacity = booking.roomItems.reduce(
        (total, item) => total + item.maxOccupancySnapshot,
        0,
      );
      if (booking.adultCount + booking.childCount > totalCapacity) {
        throw new BookingCapacityExceededException();
      }
    }
    if (input.guestName !== undefined) {
      booking.guestName = input.guestName.trim();
    }
    if (input.guestEmail !== undefined) {
      booking.guestEmail = input.guestEmail.trim().toLowerCase();
    }
    if (input.guestPhone !== undefined) {
      booking.guestPhone = input.guestPhone.trim();
    }
    if (input.specialRequests !== undefined) {
      booking.specialRequests = this.normalizeNullable(input.specialRequests);
    }

    return this.repository.save(booking);
  }

  async updateForActor(
    id: string,
    input: UpdateBookingRequest,
    actor: AuthorizationActor,
  ): Promise<BookingEntity> {
    const booking = await this.findById(id);
    this.assertCanModify(booking, actor);
    return this.update(id, input);
  }

  async completeForHotelOwner(
    id: string,
    actor: AuthorizationActor,
  ): Promise<BookingEntity> {
    if (actor.role !== UserRole.HOTEL_OWNER) {
      throw new AuthorizationDeniedException();
    }
    const completed = await this.repository.withLockedById(id, async (booking) => {
      await this.hotelsService.assertManagedBy(booking.hotelId, actor);
      this.assertBookingTransition(booking, BookingStatus.COMPLETED);
      booking.bookingStatus = BookingStatus.COMPLETED;
      return booking;
    });
    if (!completed) throw new BookingNotFoundException(id);
    return completed;
  }

  async cancelForActor(id: string, actor: AuthorizationActor): Promise<BookingEntity> {
    const existing = await this.findById(id);
    this.assertCanModify(existing, actor);
    const cancelled = await this.repository.withLockedById(id, async (booking) => {
      if (booking.bookingStatus !== BookingStatus.CONFIRMED) {
        throw new BookingActionNotAllowedException('cancel this booking');
      }
      const hotel = await this.hotelsService.findById(booking.hotelId);
      const checkInAt = new Date(`${booking.checkInDate}T${hotel.checkInTime}+07:00`);
      const hoursBeforeCheckIn = (checkInAt.getTime() - Date.now()) / 3_600_000;
      if (hoursBeforeCheckIn < 0) {
        throw new BookingActionNotAllowedException('cancel after check-in');
      }
      const policies = await this.cancellationPoliciesService.findPage({
        page: 1,
        limit: 1000,
        hotelId: booking.hotelId,
        sortBy: 'name',
        sortOrder: 'ASC',
      });
      const eligible = policies.items.filter((policy) =>
        hoursBeforeCheckIn >= policy.minHoursBeforeCheckIn &&
        (policy.maxHoursBeforeCheckIn === null || hoursBeforeCheckIn < policy.maxHoursBeforeCheckIn),
      );
      if (eligible.length !== 1) {
        throw new BookingActionNotAllowedException('cancel without an applicable cancellation policy');
      }
      const policy = eligible[0];
      const feeRate = policy.cancellationFeeRate ?? 0;
      const feeAmount = this.roundMoney(booking.amount * feeRate / 100);
      booking.cancellationPolicyId = policy.id;
      booking.cancellationWindowSnapshot = policy.maxHoursBeforeCheckIn;
      booking.cancellationFeeRateSnapshot = feeRate;
      booking.cancellationDescriptionSnapshot = policy.description ?? policy.name;
      booking.cancellationFeeAmount = feeAmount;
      booking.bookingStatus = BookingStatus.CANCELLED;
      booking.cancelledAt = new Date();
      const refundAmount = this.roundMoney(Math.max(0, booking.amount - feeAmount));
      booking.refundAmount = booking.paymentStatus === PaymentStatus.PAID && refundAmount > 0
        ? refundAmount
        : null;
      booking.refundReason = booking.refundAmount === null
        ? null
        : `Khách hủy booking theo chính sách: ${policy.name}`;
      booking.refundStatus = booking.refundAmount === null ? RefundStatus.NONE : RefundStatus.PENDING;
      return booking;
    });
    if (!cancelled) throw new BookingNotFoundException(id);
    return cancelled;
  }

  async createVnpayPaymentForActor(
    id: string,
    input: CreateVnpayPaymentRequest,
    customerIp: string,
    actor: AuthorizationActor,
  ): Promise<CreatedVnpayPayment> {
    const booking = await this.findById(id);
    this.assertCanModify(booking, actor);
    return this.createVnpayPayment(id, input, customerIp);
  }

  async createVnpayPayment(
    id: string,
    input: CreateVnpayPaymentRequest,
    customerIp: string,
  ): Promise<CreatedVnpayPayment> {
    const now = new Date();
    const holdMinutes = this.configService.getOrThrow<number>(
      'BOOKING_HOLD_MINUTES',
    );
    const expiresAt = new Date(now.getTime() + holdMinutes * 60_000);
    const result = await this.repository.withLockedById(id, (booking) => {
      this.assertPayable(booking, 'create VNPAY payment');
      if (booking.reservationExpiresAt <= now) {
        throw new BookingReservationExpiredException();
      }
      if (
        booking.paymentStatus !== PaymentStatus.PENDING ||
        booking.paymentCreatedAt !== null
      ) {
        throw new BookingPaymentAlreadyInitializedException();
      }
      if (booking.currency !== 'VND') {
        throw new VnpayCurrencyNotSupportedException();
      }
      if (!Number.isInteger(booking.amount) || booking.amount < 5_000) {
        throw new VnpayAmountNotSupportedException();
      }

      booking.paymentMethod = null;
      booking.paymentStatus = PaymentStatus.PAYMENT_PENDING;
      booking.paymentCreatedAt = now;
      booking.paymentExpiresAt = expiresAt;
      booking.reservationExpiresAt = expiresAt;
      const paymentUrl = this.vnpayGateway.createPaymentUrl({
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        amount: booking.amount,
        customerIp,
        createdAt: now,
        expiresAt,
        locale: input.locale,
      });
      return { booking, paymentUrl };
    });
    if (!result) throw new BookingNotFoundException(id);
    return result;
  }

  async handleVnpayIpn(
    query: Record<string, unknown>,
  ): Promise<VnpayIpnResponse> {
    const callback = this.vnpayGateway.verifyPaymentCallback(query);
    if (!callback.signatureValid || !callback.terminalCodeValid) {
      return { RspCode: '97', Message: 'Invalid signature' };
    }
    if (!callback.bookingId) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    const response = await this.repository.withLockedById(
      callback.bookingId,
      (booking): VnpayIpnResponse => {
        if (callback.amount !== booking.amount) {
          return { RspCode: '04', Message: 'Invalid amount' };
        }
        if (
          booking.paymentStatus !== PaymentStatus.PAYMENT_PENDING ||
          booking.paymentTransactionId !== null
        ) {
          return { RspCode: '02', Message: 'Order already confirmed' };
        }

        const successful =
          callback.responseCode === '00' && callback.transactionStatus === '00';
        if (successful) {
          if (!callback.transactionId || !callback.paidAt) {
            return { RspCode: '99', Message: 'Invalid payment data' };
          }
          booking.paymentStatus = PaymentStatus.PAID;
          booking.paymentMethod = this.resolveVnpayPaymentMethod(
            callback.cardType,
            callback.bankCode,
          );
          booking.paymentTransactionId = callback.transactionId;
          booking.paidAt = callback.paidAt;
          if (booking.bookingStatus === BookingStatus.PENDING) {
            booking.bookingStatus = BookingStatus.CONFIRMED;
          }
        } else {
          booking.paymentStatus =
            callback.responseCode === '11'
              ? PaymentStatus.EXPIRED
              : PaymentStatus.FAILED;
        }
        return { RspCode: '00', Message: 'Confirm Success' };
      },
    );
    return response ?? { RspCode: '01', Message: 'Order not found' };
  }

  async getVnpayReturn(
    query: Record<string, unknown>,
  ): Promise<VnpayReturnResponse> {
    const callback = this.vnpayGateway.verifyPaymentCallback(query);
    const signatureValid =
      callback.signatureValid && callback.terminalCodeValid;
    if (!signatureValid || !callback.bookingId) {
      return {
        signatureValid: false,
        bookingId: null,
        bookingCode: null,
        paymentStatus: null,
        responseCode: callback.responseCode,
        transactionStatus: callback.transactionStatus,
      };
    }
    const booking = await this.repository.findById(callback.bookingId);
    return {
      signatureValid: true,
      bookingId: booking?.id ?? callback.bookingId,
      bookingCode: booking?.bookingCode ?? null,
      paymentStatus: booking?.paymentStatus ?? null,
      responseCode: callback.responseCode,
      transactionStatus: callback.transactionStatus,
    };
  }

  async settle(
    id: string,
    input: SettleBookingRequest,
  ): Promise<BookingEntity> {
    const booking = await this.findById(id);
    if (booking.paymentStatus !== PaymentStatus.PAID) {
      throw new BookingPaymentRequiredException('settlement');
    }
    if (booking.settlementStatus === SettlementStatus.SETTLED) {
      throw new BookingAlreadySettledException();
    }
    if (input.settlementBaseAmount > booking.amount) {
      throw new SettlementBaseAmountExceededException();
    }

    const commissionAmount = this.roundMoney(
      (input.settlementBaseAmount * booking.appliedCommissionRate) / 100,
    );
    booking.settlementBaseAmount = input.settlementBaseAmount;
    booking.commissionAmount = commissionAmount;
    booking.partnerReceivableAmount = this.roundMoney(
      input.settlementBaseAmount - commissionAmount,
    );
    booking.settlementStatus = SettlementStatus.SETTLED;
    booking.transactionId = input.transactionId.trim();
    booking.bankNameSnapshot = input.bankNameSnapshot.trim();
    booking.bankAccountNumberSnapshot = input.bankAccountNumberSnapshot.trim();
    booking.bankAccountHolderSnapshot = input.bankAccountHolderSnapshot.trim();
    booking.settledAt = this.resolveNotFutureTimestamp(
      input.settledAt,
      'settledAt',
    );
    return this.repository.save(booking);
  }

  async refund(
    id: string,
    input: RefundBookingRequest,
    customerIp: string,
  ): Promise<BookingEntity> {
    const prepared = await this.repository.withLockedById(id, (booking) => {
      if (booking.paymentStatus !== PaymentStatus.PAID) {
        throw new BookingPaymentRequiredException('refund');
      }
      const policyRefund =
        booking.bookingStatus === BookingStatus.CANCELLED &&
        booking.refundStatus === RefundStatus.PENDING &&
        booking.refundAmount !== null;
      if (booking.refundStatus !== RefundStatus.NONE && !policyRefund) {
        throw new BookingRefundAlreadyInitializedException();
      }
      if (policyRefund && input.refundAmount !== booking.refundAmount) {
        throw new RefundAmountExceededException();
      }
      if (input.refundAmount > booking.amount) {
        throw new RefundAmountExceededException();
      }
      if (!booking.paymentTransactionId || !booking.paymentCreatedAt) {
        throw new BookingActionNotAllowedException('VNPAY refund');
      }
      if (!policyRefund) {
        booking.refundAmount = input.refundAmount;
        booking.refundReason = input.refundReason.trim();
      }
      booking.refundStatus = RefundStatus.PENDING;
      return {
        originalAmount: booking.amount,
        originalTransactionId: booking.paymentTransactionId,
        originalTransactionDate: booking.paymentCreatedAt,
      };
    });
    if (!prepared) throw new BookingNotFoundException(id);

    let result: VnpayRefundResult;
    try {
      result = await this.vnpayGateway.refund({
        bookingId: id,
        amount: input.refundAmount,
        originalAmount: prepared.originalAmount,
        originalTransactionId: prepared.originalTransactionId,
        originalTransactionDate: prepared.originalTransactionDate,
        reason: input.refundReason.trim(),
        customerIp,
      });
    } catch (error) {
      await this.repository.withLockedById(id, (booking) => {
        if (booking.refundStatus === RefundStatus.PENDING) {
          booking.refundStatus = RefundStatus.FAILED;
        }
      });
      throw error;
    }

    const updated = await this.repository.withLockedById(id, (booking) => {
      booking.refundTransactionId = result.transactionId ?? result.requestId;
      if (result.responseCode === '00' && result.transactionStatus === '00') {
        booking.refundStatus = RefundStatus.REFUNDED;
        booking.refundedAt = result.payDate ?? new Date();
        booking.bookingStatus = BookingStatus.CANCELLED;
        booking.cancelledAt ??= new Date();
      } else if (
        result.responseCode === '00' &&
        ['05', '06'].includes(result.transactionStatus ?? '')
      ) {
        booking.refundStatus = RefundStatus.PENDING;
      } else {
        booking.refundStatus = RefundStatus.FAILED;
      }
      return booking;
    });
    if (!updated) throw new BookingNotFoundException(id);
    return updated;
  }

  private async assertCanView(
    booking: BookingEntity,
    actor: AuthorizationActor,
  ): Promise<void> {
    if (actor.role === UserRole.ADMIN || booking.touristId === actor.id) {
      return;
    }
    if (actor.role === UserRole.HOTEL_OWNER) {
      await this.hotelsService.assertManagedBy(booking.hotelId, actor);
      return;
    }
    throw new AuthorizationDeniedException();
  }

  private assertCanModify(
    booking: BookingEntity,
    actor: AuthorizationActor,
  ): void {
    if (actor.role !== UserRole.ADMIN && booking.touristId !== actor.id) {
      throw new AuthorizationDeniedException();
    }
  }

  private assertBookingTransition(
    booking: BookingEntity,
    next: BookingStatus,
  ): void {
    const allowed: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.PENDING]: [
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
      ],
      [BookingStatus.CONFIRMED]: [
        BookingStatus.CONFIRMED,
        BookingStatus.COMPLETED,
      ],
      [BookingStatus.CANCELLED]: [BookingStatus.CANCELLED],
      [BookingStatus.COMPLETED]: [BookingStatus.COMPLETED],
    };
    if (!allowed[booking.bookingStatus].includes(next)) {
      throw new InvalidBookingTransitionException(booking.bookingStatus, next);
    }
    if (
      [BookingStatus.CONFIRMED, BookingStatus.COMPLETED].includes(next) &&
      booking.paymentStatus !== PaymentStatus.PAID
    ) {
      throw new BookingPaymentRequiredException(
        next === BookingStatus.CONFIRMED ? 'confirmation' : 'completion',
      );
    }
  }

  private assertPayable(booking: BookingEntity, action: string): void {
    if (
      booking.bookingStatus === BookingStatus.CANCELLED ||
      booking.bookingStatus === BookingStatus.COMPLETED
    ) {
      throw new BookingActionNotAllowedException(action);
    }
    if (booking.paymentStatus === PaymentStatus.PAID) {
      throw new BookingAlreadyPaidException();
    }
  }

  private resolveNotFutureTimestamp(
    value: string | undefined,
    field: string,
  ): Date {
    const timestamp = value ? new Date(value) : new Date();
    if (timestamp > new Date()) {
      throw new InvalidBookingFinancialTimestampException(field);
    }
    return timestamp;
  }

  private isEmptyUpdate(input: UpdateBookingRequest): boolean {
    return [
      input.adultCount,
      input.childCount,
      input.guestName,
      input.guestEmail,
      input.guestPhone,
      input.specialRequests,
      input.bookingStatus,
    ].every((value) => value === undefined);
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }

  private resolveNumberOfNights(
    checkInDate: string,
    checkOutDate: string,
  ): number {
    const checkIn = Date.parse(`${checkInDate}T00:00:00.000Z`);
    const checkOut = Date.parse(`${checkOutDate}T00:00:00.000Z`);
    const numberOfNights = (checkOut - checkIn) / 86_400_000;
    if (!Number.isInteger(numberOfNights) || numberOfNights < 1) {
      throw new InvalidBookingStayException();
    }
    return numberOfNights;
  }

  private resolveVnpayPaymentMethod(
    cardType: string | null,
    bankCode: string | null,
  ): PaymentMethod {
    const normalizedCardType = cardType?.trim().toUpperCase() ?? '';
    const normalizedBankCode = bankCode?.trim().toUpperCase() ?? '';

    if (normalizedCardType === 'QRCODE' || normalizedBankCode === 'VNPAYQR') {
      return PaymentMethod.QR;
    }
    if (
      ['CREDIT', 'INTCARD'].includes(normalizedCardType) ||
      ['VISA', 'MASTERCARD', 'JCB', 'AMEX', 'UPI'].includes(normalizedBankCode)
    ) {
      return PaymentMethod.CARD;
    }
    return PaymentMethod.BANK_TRANSFER;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
