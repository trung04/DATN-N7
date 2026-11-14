import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { HotelsService } from '../../hotels/services/hotels.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { UserRole } from '../../users/entities/user.entity';
import { CancellationPoliciesService } from '../../cancellation-policies/services/cancellation-policies.service';
import { RoomOperationalStatus } from '../../rooms/entities/room.entity';
import { RoomsService } from '../../rooms/services/rooms.service';
import { CreateBookingRequest } from '../dtos/requests/create-booking.request';
import { SearchRoomAvailabilityRequest } from '../dtos/requests/search-room-availability.request';
import { ListBookingsRequest } from '../dtos/requests/list-bookings.request';
import { RefundBookingRequest } from '../dtos/requests/refund-booking.request';
import { SePayV2RequestException } from '../integrations/sepay/sepay-v2.client';
import { UpdateBookingRequest } from '../dtos/requests/update-booking.request';
import {
  BookingCancellationRuleSnapshot,
  BookingEntity,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  SettlementStatus,
} from '../entities/booking.entity';
import {
  BookingActionNotAllowedException,
  BookingCancellationNotAllowedException,
  BookingAlreadyPaidException,
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
  SePayAmountNotSupportedException,
  SePayCurrencyNotSupportedException,
} from '../exceptions/booking.exceptions';
import { BOOKING_CODE_GENERATOR } from '../interfaces/booking-code-generator.interface';
import type { BookingCodeGenerator } from '../interfaces/booking-code-generator.interface';
import { BOOKING_REPOSITORY } from '../interfaces/booking.repository.interface';
import type {
  BookingPage,
  BookingRepository,
  CreatedBookingResult,
} from '../interfaces/booking.repository.interface';
import { SEPAY_V2_CLIENT } from '../interfaces/sepay-v2.interface';
import type { SePayV2Client, SePayWebhookPayload } from '../interfaces/sepay-v2.interface';
import { assessCancellation } from './cancellation-assessment';

export interface CreatedSePayPayment {
  booking: BookingEntity;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly repository: BookingRepository,
    @Inject(BOOKING_CODE_GENERATOR)
    private readonly codeGenerator: BookingCodeGenerator,
    @Inject(SEPAY_V2_CLIENT)
    private readonly sepay: SePayV2Client,
    private readonly cancellationPoliciesService: CancellationPoliciesService,
    private readonly roomsService: RoomsService,
    private readonly configService: ConfigService,
    private readonly hotelsService: HotelsService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async searchRoomAvailability(
    input: SearchRoomAvailabilityRequest,
  ): Promise<{
    hotelId: string | null;
    checkInDate: string;
    checkOutDate: string;
    availableRoomIds: string[];
  }> {
    this.resolveNumberOfNights(input.checkInDate, input.checkOutDate);
    if (input.hotelId) await this.hotelsService.assertActive(input.hotelId);
    const [bookableRooms, unavailableRoomIds] = await Promise.all([
      this.roomsService.findBookableByHotel(input.hotelId),
      this.repository.findUnavailableRoomIds(
        input.hotelId,
        input.checkInDate,
        input.checkOutDate,
      ),
    ]);
    const unavailable = new Set(unavailableRoomIds);
    return {
      hotelId: input.hotelId ?? null,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      availableRoomIds: bookableRooms
        .filter((room) => !unavailable.has(room.id))
        .map((room) => room.id),
    };
  }

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
    const hotel = await this.hotelsService.assertActive(hotelId);
    const cancellationSchedule = await this.cancellationPoliciesService
      .getCompleteScheduleForBooking(hotelId, input.cancellationPolicyVersion);
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
        cancellationPolicySnapshot: {
          version: cancellationSchedule.version,
          basis: 'HOURS_AFTER_BOOKING',
          cancelHours: cancellationSchedule.rules[0]!.cancelHours,
          penaltyPercent: cancellationSchedule.rules[0]!.penaltyPercent,
          cancellationAllowed: cancellationSchedule.rules[0]!.cancellationAllowed,
          policyName: cancellationSchedule.rules[0]!.name,
          policyDescription: cancellationSchedule.rules[0]!.description,
          timezone: 'Asia/Ho_Chi_Minh',
          checkInTime: hotel.checkInTime,
          rules: cancellationSchedule.rules.map((rule) => ({
            ...rule,
            minHoursAfterBooking: 0,
            maxHoursAfterBooking: null,
            cancellationFeeRate: rule.penaltyPercent,
          })),
        },
        cancellationWindowSnapshot: null,
        cancellationFeeRateSnapshot: null,
        cancellationDescriptionSnapshot: null,
        refundStatus: RefundStatus.NONE,
        refundRequestedAt: null,
        refundProcessingAt: null,
        refundAttempt: 0,
        refundFailureReason: null,
        refundFailedAt: null,
        refundHandledBy: null,
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
      cancellationPolicyVersion: input.cancellationPolicyVersion,
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
      const unpaidPending =
        booking.bookingStatus === BookingStatus.PENDING &&
        booking.paymentStatus !== PaymentStatus.PAID;
      if (!unpaidPending && booking.bookingStatus !== BookingStatus.CONFIRMED) {
        throw new BookingActionNotAllowedException('cancel this booking');
      }
      let policy: BookingCancellationRuleSnapshot | null = null;
      if (!unpaidPending) {
        const assessment = assessCancellation(booking);
        if (!assessment.allowed || !assessment.rule) {
          throw new BookingCancellationNotAllowedException(
            assessment.reason ?? 'Booking không đủ điều kiện hủy theo chính sách đã xác nhận.',
          );
        }
        policy = assessment.rule;
      }
      const feeRate = policy
        ? policy.cancellationFeeRate ?? policy.penaltyPercent ?? 0
        : 0;
      const feeAmount = unpaidPending
        ? 0
        : this.roundVnd(booking.amount * feeRate / 100);
      if (policy) booking.cancellationPolicyId = policy.id;
      if (policy) booking.cancellationWindowSnapshot = policy.cancelHours ?? policy.maxHoursAfterBooking ??
        policy.maxHoursBeforeCheckIn ?? null;
      booking.cancellationFeeRateSnapshot = feeRate;
      booking.cancellationDescriptionSnapshot = unpaidPending
        ? 'Hủy trước khi thanh toán; không phát sinh phí hủy.'
        : policy!.description ?? policy!.name;
      booking.cancellationFeeAmount = feeAmount;
      booking.bookingStatus = BookingStatus.CANCELLED;
      booking.cancelledAt = new Date();
      // Keep PAYMENT_PENDING intact: if a payment races with cancellation,
      // the SePay webhook can recognize it and trigger a full refund.
      const refundAmount = this.roundVnd(Math.max(0, booking.amount - feeAmount));
      booking.refundAmount = !unpaidPending && booking.paymentStatus === PaymentStatus.PAID && refundAmount > 0
        ? refundAmount
        : null;
      booking.refundReason = booking.refundAmount === null
        ? null
        : `Khách hủy booking theo chính sách: ${policy?.name ?? 'đã xác nhận'}`;
      booking.refundStatus = booking.refundAmount === null ? RefundStatus.NONE : RefundStatus.PENDING;
      booking.refundRequestedAt = booking.refundAmount === null ? null : booking.cancelledAt;
      booking.refundProcessingAt = null;
      booking.refundAttempt = booking.refundAmount === null ? 0 : 1;
      booking.refundFailureReason = null;
      booking.refundFailedAt = null;
      booking.refundHandledBy = null;
      return booking;
    });
    if (!cancelled) throw new BookingNotFoundException(id);
    await this.notify(
      cancelled,
      NotificationType.BOOKING_CANCELLED,
      `booking:${cancelled.id}:cancelled`,
      'Booking đã được hủy',
      `Booking ${cancelled.bookingCode} đã được hủy theo chính sách.`,
    );
    return cancelled.refundAmount !== null && cancelled.refundAmount > 0
      ? this.submitSePayRefund(id)
      : cancelled;
  }

  async createSePayPaymentForActor(
    id: string,
    actor: AuthorizationActor,
  ): Promise<CreatedSePayPayment> {
    const booking = await this.findById(id);
    this.assertCanModify(booking, actor);
    return this.createSePayPayment(id);
  }

  async createSePayPayment(id: string): Promise<CreatedSePayPayment> {
    const now = new Date();
    const holdMinutes = this.configService.getOrThrow<number>(
      'BOOKING_HOLD_MINUTES',
    );
    const expiresAt = new Date(now.getTime() + holdMinutes * 60_000);
    const reservation = await this.repository.withLockedById(id, (booking) => {
      this.assertPayable(booking, 'create SePay payment');
      if (booking.reservationExpiresAt <= now) {
        throw new BookingReservationExpiredException();
      }
      if (
        booking.paymentStatus === PaymentStatus.PAYMENT_PENDING &&
        booking.paymentCreatedAt !== null &&
        booking.paymentExpiresAt !== null &&
        booking.paymentExpiresAt > now
      ) {
        if (booking.sepayOrderXid) return { booking, createOrder: false };
        if (booking.paymentCreatedAt.getTime() > now.getTime() - 30_000) {
          throw new BookingPaymentAlreadyInitializedException();
        }
      }
      if (booking.paymentStatus !== PaymentStatus.PAYMENT_PENDING && (
        booking.paymentStatus !== PaymentStatus.PENDING ||
        booking.paymentCreatedAt !== null
      )) {
        throw new BookingPaymentAlreadyInitializedException();
      }
      if (booking.currency !== 'VND') {
        throw new SePayCurrencyNotSupportedException();
      }
      if (!Number.isInteger(booking.amount) || booking.amount <= 0) {
        throw new SePayAmountNotSupportedException();
      }

      booking.paymentMethod = PaymentMethod.BANK_TRANSFER;
      booking.paymentStatus = PaymentStatus.PAYMENT_PENDING;
      booking.paymentCreatedAt ??= now;
      booking.paymentExpiresAt ??= expiresAt;
      booking.reservationExpiresAt = booking.paymentExpiresAt;
      booking.sepayOrderCode ??= `BK${createHash('sha256').update(booking.id).digest('hex').slice(0, 13).toUpperCase()}`;
      return { booking, createOrder: !booking.sepayOrderXid };
    });
    if (!reservation) throw new BookingNotFoundException(id);
    if (!reservation.createOrder) return { booking: reservation.booking };

    const order = await this.sepay.createOrder({
      orderCode: reservation.booking.sepayOrderCode!,
      amount: reservation.booking.amount,
      durationSeconds: holdMinutes * 60,
    });
    const saved = await this.repository.withLockedById(id, (booking) => {
      if (booking.sepayOrderCode !== order.order_code) {
        throw new BookingActionNotAllowedException('save the SePay order');
      }
      booking.sepayOrderXid = order.id;
      booking.sepayOrderCode = order.order_code;
      booking.sepayVaNumber = order.va_number ?? null;
      booking.sepayQrCode = order.qr_code ?? order.qr_code_url ?? null;
      booking.sepayBankName = order.bank_name ?? null;
      booking.sepayAccountNumber = order.account_number ?? null;
      booking.sepayAccountHolderName = order.account_holder_name ?? order.va_holder_name ?? null;
      booking.sepayOrderStatus = order.status;
      if (order.expired_at) {
        const expires = new Date(order.expired_at.replace(' ', 'T') + '+07:00');
        if (!Number.isNaN(expires.getTime())) booking.paymentExpiresAt = expires;
      }
      return booking;
    });
    if (!saved) throw new BookingNotFoundException(id);
    return { booking: saved };
  }

  async handleSePayV2Webhook(payload: SePayWebhookPayload): Promise<boolean> {
    const code = typeof payload.code === 'string' ? payload.code.trim().toUpperCase() : '';
    const booking = code ? await this.repository.findBySePayOrderCode(code) : null;
    if (!booking) return false;
    if (String(payload.transferType ?? '').toLowerCase() !== 'in') return false;
    if (Number(payload.transferAmount) !== booking.amount) return false;
    if (payload.subAccount && booking.sepayVaNumber &&
      payload.subAccount.toUpperCase() !== booking.sepayVaNumber.toUpperCase()) return false;
    const transactionId = payload.id === undefined ? '' : String(payload.id);
    if (!transactionId) return false;

    const updated = await this.repository.withLockedById(booking.id, (current) => {
      if (current.paymentStatus === PaymentStatus.PAID) {
        return {
          accepted: current.paymentTransactionId === transactionId,
          newlyPaid: false,
          booking: current,
          wasConfirmed: false,
        };
      }
      if (current.paymentStatus !== PaymentStatus.PAYMENT_PENDING ||
        current.paymentTransactionId !== null) {
        return { accepted: false, newlyPaid: false, booking: current, wasConfirmed: false };
      }

      current.paymentStatus = PaymentStatus.PAID;
      current.paymentMethod = PaymentMethod.BANK_TRANSFER;
      current.paymentTransactionId = transactionId;
      current.sepayOrderStatus = 'Paid';
      const paidAt = typeof payload.transactionDate === 'string'
        ? new Date(payload.transactionDate.replace(' ', 'T') + '+07:00')
        : new Date();
      current.paidAt = Number.isNaN(paidAt.getTime()) ? new Date() : paidAt;
      const wasConfirmed = current.bookingStatus === BookingStatus.PENDING;
      const latePaymentAfterCancellation = current.bookingStatus === BookingStatus.CANCELLED;
      if (current.bookingStatus === BookingStatus.PENDING) {
        current.bookingStatus = BookingStatus.CONFIRMED;
      }
      if (latePaymentAfterCancellation) {
        current.refundAmount = current.amount;
        current.refundReason = 'Thanh toán nhận được sau khi booking đã bị hủy.';
        current.refundStatus = RefundStatus.PENDING;
        current.refundRequestedAt = new Date();
        current.refundProcessingAt = null;
        current.refundAttempt = 1;
        current.refundFailureReason = null;
        current.refundFailedAt = null;
        current.refundHandledBy = null;
      }
      return {
        accepted: true,
        newlyPaid: true,
        booking: current,
        wasConfirmed,
        latePaymentAfterCancellation,
      };
    });
    if (!updated?.accepted) return false;
    if (updated.newlyPaid) {
      const amount = this.formatVnd(updated.booking.amount);
      await this.notify(
        updated.booking,
        NotificationType.PAYMENT_SUCCEEDED,
        `booking:${updated.booking.id}:payment-succeeded`,
        'Thanh toán thành công',
        `Đã nhận thanh toán ${amount} cho booking ${updated.booking.bookingCode}.${this.sandboxNotice()}`,
      );
      if (updated.wasConfirmed) {
        await this.notify(
          updated.booking,
          NotificationType.BOOKING_CONFIRMED,
          `booking:${updated.booking.id}:confirmed`,
          'Booking đã được xác nhận',
          `Booking ${updated.booking.bookingCode} đã được khách sạn xác nhận.`,
        );
      }
    }
    if (
      updated.booking.bookingStatus === BookingStatus.CANCELLED &&
      updated.booking.refundStatus === RefundStatus.PENDING &&
      updated.booking.refundAmount !== null &&
      !updated.booking.sepayRefundId
    ) {
      await this.submitSePayRefund(updated.booking.id);
    }
    return true;
  }

  async refund(
    id: string,
    input: RefundBookingRequest,
    _customerIp?: string,
  ): Promise<BookingEntity> {
    const initialized = await this.repository.withLockedById(id, (booking) => {
      if (booking.paymentStatus !== PaymentStatus.PAID) {
        throw new BookingPaymentRequiredException('refund');
      }
      if (booking.settlementStatus !== SettlementStatus.PENDING) {
        throw new BookingActionNotAllowedException(
          'refund after hotel settlement has started',
        );
      }
      if (!booking.sepayOrderXid) {
        throw new BookingActionNotAllowedException('SePay v2 refund without a VA order');
      }
      const retry = booking.refundStatus === RefundStatus.FAILED && booking.refundAmount !== null;
      const active = [RefundStatus.PENDING, RefundStatus.PROCESSING].includes(booking.refundStatus);
      if (booking.refundStatus !== RefundStatus.NONE && !retry && !active) {
        throw new BookingRefundAlreadyInitializedException();
      }
      if ((retry || active) && input.refundAmount !== booking.refundAmount) {
        throw new RefundAmountExceededException();
      }
      if (input.refundAmount > booking.amount) {
        throw new RefundAmountExceededException();
      }
      if (!Number.isInteger(input.refundAmount) || input.refundAmount <= 0) {
        throw new SePayAmountNotSupportedException();
      }
      booking.refundReason = input.refundReason.trim();
      if (booking.refundStatus === RefundStatus.NONE) {
        booking.refundAmount = input.refundAmount;
        booking.refundAttempt = 1;
      } else if (retry) {
        booking.refundAttempt = (booking.refundAttempt ?? 0) + 1;
        booking.sepayRefundId = null;
        booking.sepayRefundProviderStatus = null;
        booking.sepayRefundIdempotencyKey = null;
      }
      booking.refundStatus = RefundStatus.PENDING;
      booking.refundRequestedAt = new Date();
      booking.refundProcessingAt = null;
      booking.refundHandledBy = null;
      return booking;
    });
    if (!initialized) throw new BookingNotFoundException(id);
    return this.submitSePayRefund(id);
  }

  async syncSePayRefund(id: string): Promise<BookingEntity> {
    const booking = await this.findById(id);
    if (!booking.sepayRefundId) return this.submitSePayRefund(id);
    let refund;
    try {
      refund = await this.sepay.getRefund(booking.sepayRefundId);
    } catch {
      return booking;
    }
    const updated = await this.repository.withLockedById(id, (current) => {
      if (current.sepayRefundId !== refund.refund_id) return current;
      current.sepayRefundProviderStatus = refund.status;
      current.refundTransactionId = refund.refund_id;
      if (refund.status === 'succeeded') {
        current.refundStatus = RefundStatus.REFUNDED;
        current.refundedAt ??= new Date();
        current.refundFailureReason = null;
      } else if (refund.status === 'failed' || refund.status === 'rejected') {
        current.refundStatus = RefundStatus.FAILED;
      current.refundFailureReason = 'SePay chưa phản hồi kết quả. Có thể đồng bộ lại an toàn bằng cùng mã chống trùng.';
        current.refundFailedAt = new Date();
      } else {
        current.refundStatus = RefundStatus.PROCESSING;
      }
      return current;
    });
    if (!updated) throw new BookingNotFoundException(id);
    await this.notifyRefundStatus(updated);
    return updated;
  }

  private async submitSePayRefund(id: string): Promise<BookingEntity> {
    const request = await this.repository.withLockedById(id, (booking) => {
      if (!booking.sepayOrderXid || booking.refundAmount === null || booking.refundAmount <= 0) {
        throw new BookingActionNotAllowedException('submit SePay v2 refund');
      }
      if (![RefundStatus.PENDING, RefundStatus.PROCESSING].includes(booking.refundStatus)) {
        throw new BookingActionNotAllowedException('retry this SePay refund');
      }
      booking.sepayRefundIdempotencyKey ??= `refund-${booking.id.replaceAll('-', '')}-${booking.refundAttempt || 1}`;
      booking.refundStatus = RefundStatus.PROCESSING;
      booking.refundProcessingAt ??= new Date();
      return {
        orderXid: booking.sepayOrderXid,
        amount: booking.refundAmount,
        key: booking.sepayRefundIdempotencyKey,
      };
    });
    if (!request) throw new BookingNotFoundException(id);

    let refund;
    try {
      refund = await this.sepay.refundOrder(request.orderXid, request.amount, request.key);
    } catch (error) {
      const rejection = error instanceof SePayV2RequestException ? error : null;
      const permanentRejection = rejection !== null &&
        rejection.providerStatus >= 400 && rejection.providerStatus < 500 &&
        rejection.providerStatus !== 408 && rejection.providerStatus !== 429;
      const current = await this.repository.withLockedById(id, (booking) => {
        if (booking.sepayRefundIdempotencyKey !== request.key) return booking;
        if (permanentRejection) {
          booking.refundStatus = RefundStatus.FAILED;
          booking.refundFailureReason = `SePay từ chối yêu cầu hoàn tiền (HTTP ${rejection!.providerStatus}, ${rejection!.providerErrorCode}).`;
          booking.refundFailedAt = new Date();
        } else {
          booking.refundFailureReason = 'SePay chưa phản hồi kết quả. Có thể đồng bộ lại an toàn bằng cùng mã chống trùng.';
        }
        return booking;
      });
      if (!current) throw new BookingNotFoundException(id);
      await this.notifyRefundStatus(current);
      return current;
    }
    const updated = await this.repository.withLockedById(id, (booking) => {
      if (booking.sepayRefundIdempotencyKey !== request.key) return booking;
      booking.sepayRefundId = refund.refund_id;
      booking.sepayRefundProviderStatus = refund.status;
      booking.refundTransactionId = refund.refund_id;
      booking.refundFailureReason = null;
      if (refund.status === 'succeeded') {
        booking.refundStatus = RefundStatus.REFUNDED;
        booking.refundedAt ??= new Date();
      } else if (refund.status === 'failed' || refund.status === 'rejected') {
        booking.refundStatus = RefundStatus.FAILED;
        booking.refundFailureReason = `SePay refund ${refund.status}.`;
        booking.refundFailedAt = new Date();
      } else {
        booking.refundStatus = RefundStatus.PROCESSING;
      }
      return booking;
    });
    if (!updated) throw new BookingNotFoundException(id);
    await this.notifyRefundStatus(updated);
    return updated;
  }

  private async notifyRefundStatus(booking: BookingEntity): Promise<void> {
    if (booking.refundStatus === RefundStatus.NONE || booking.refundAmount === null) return;
    const amount = this.formatVnd(booking.refundAmount);
    if (booking.refundStatus === RefundStatus.PROCESSING) {
      await this.notify(
        booking,
        NotificationType.REFUND_PROCESSING,
        `booking:${booking.id}:refund:${booking.refundAttempt}:processing`,
        'Hoàn tiền đang được xử lý',
        `Yêu cầu hoàn ${amount} cho booking ${booking.bookingCode} đang chờ SePay xác nhận.`,
      );
    } else if (booking.refundStatus === RefundStatus.REFUNDED) {
      await this.notify(
        booking,
        NotificationType.REFUND_SUCCEEDED,
        `booking:${booking.id}:refund:${booking.refundAttempt}:succeeded`,
        'SePay đã xác nhận hoàn tiền',
        `SePay xác nhận hoàn ${amount} cho booking ${booking.bookingCode} thành công.${this.sandboxNotice()}`,
      );
    } else if (booking.refundStatus === RefundStatus.FAILED) {
      const reason = booking.refundFailureReason ? ` Lý do: ${booking.refundFailureReason}` : '';
      await this.notify(
        booking,
        NotificationType.REFUND_FAILED,
        `booking:${booking.id}:refund:${booking.refundAttempt}:failed`,
        'Hoàn tiền chưa thành công',
        `Yêu cầu hoàn ${amount} cho booking ${booking.bookingCode} chưa thành công.${reason}`,
      );
    }
  }

  private async notify(
    booking: BookingEntity,
    type: NotificationType,
    eventKey: string,
    title: string,
    message: string,
  ): Promise<void> {
    if (!this.notificationsService) return;
    try {
      await this.notificationsService.createOnce({
        userId: booking.touristId,
        type,
        title,
        message,
        link: `/bookings/${booking.id}`,
        eventKey,
      });
    } catch {
      this.logger.error(
        `Failed to persist booking notification (${type}).`,
      );
    }
  }

  private formatVnd(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  }

  private sandboxNotice(): string {
    const baseUrl = this.configService.get<string>('SEPAY_V2_BASE_URL') ?? '';
    return baseUrl.includes('sandbox') ? ' Đây là kết quả mô phỏng trong môi trường thử nghiệm.' : '';
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

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private roundVnd(value: number): number {
    return Math.round(value + Number.EPSILON);
  }
}
