import { UnauthorizedException, ConflictException, Inject, Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { HotelsService } from '../../hotels/services/hotels.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import type { SettingsReader } from '../../platform-settings/platform-settings.catalog';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { UserRole } from '../../users/entities/user.entity';
import { CancellationPoliciesService } from '../../cancellation-policies/services/cancellation-policies.service';
import { RoomOperationalStatus, RoomEntity } from '../../rooms/entities/room.entity';
import { RoomGuestPolicyEntity } from '../../rooms/entities/room-guest-policy.entity';
import { RoomsService } from '../../rooms/services/rooms.service';
import { CreateBookingRequest } from '../dtos/requests/create-booking.request';
import { RoomGuestAllocationRequest } from '../dtos/requests/room-guest-allocation.request';
import { SearchRoomAvailabilityRequest } from '../dtos/requests/search-room-availability.request';
import { ListBookingsRequest } from '../dtos/requests/list-bookings.request';
import { ConfirmManualRefundRequest, RefundBookingRequest } from '../dtos/requests/refund-booking.request';
import { UpdateBookingRequest } from '../dtos/requests/update-booking.request';
import {
  BookingCancellationRuleSnapshot,
  BookingEntity,
  BookingStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  RefundStatus,
  SettlementStatus,
} from '../entities/booking.entity';
import {
  BookingActionNotAllowedException,
  BookingCancellationNotAllowedException,
  BookingAlreadyPaidException,
  BookingAlreadyRefundedException,
  BookingNotFoundException,
  BookingPaymentAlreadyInitializedException,
  BookingPaymentRequiredException,
  BookingCapacityExceededException,
  BookingGuestAllocationException,
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
  PayosAmountNotSupportedException,
  PayosCurrencyNotSupportedException,
} from '../exceptions/booking.exceptions';
import { BOOKING_CODE_GENERATOR } from '../interfaces/booking-code-generator.interface';
import type { BookingCodeGenerator } from '../interfaces/booking-code-generator.interface';
import { BOOKING_REPOSITORY } from '../interfaces/booking.repository.interface';
import type {
  BookingPage,
  BookingRepository,
  CreatedBookingResult,
} from '../interfaces/booking.repository.interface';
import { PAYOS_GATEWAY } from '../interfaces/payos-gateway.interface';
import type { PayosGateway, PayosPaymentInfo, PayosRefundInput, PayosRefundResult } from '../interfaces/payos-gateway.interface';
import { assessCancellation } from './cancellation-assessment';
import { BookingSettingsService } from './booking-settings.service';

const AUTOMATIC_REFUND_INTERVAL_MS = 10_000;
const REFUND_RECHECK_MS = 30_000;
const REFUND_ITEMS_PER_POLL = 10;

@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingsService.name);
  private readonly configService: SettingsReader;
  private refundPoller?: ReturnType<typeof setInterval>;
  private processingRefunds = false;

  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly repository: BookingRepository,
    @Inject(BOOKING_CODE_GENERATOR)
    private readonly codeGenerator: BookingCodeGenerator,
    @Inject(PAYOS_GATEWAY)
    private readonly payos: PayosGateway,
    private readonly cancellationPoliciesService: CancellationPoliciesService,
    private readonly roomsService: RoomsService,
    configService: ConfigService,
    private readonly hotelsService: HotelsService,
    private readonly bookingSettingsService: BookingSettingsService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() platformSettings?: PlatformSettingsService,
  ) {
    this.configService = platformSettings ?? configService;
  }

  onModuleInit(): void {
    this.refundPoller = setInterval(() => { void this.processAutomaticRefunds(); }, AUTOMATIC_REFUND_INTERVAL_MS);
    this.refundPoller.unref();
  }

  onModuleDestroy(): void {
    if (this.refundPoller) clearInterval(this.refundPoller);
  }

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
    const { tiers, ...cancellationPolicy } = cancellationSchedule.rules[0]!;
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
    const guestAllocations = await this.resolveGuestAllocations(
      hotelId,
      rooms,
      input,
    );

    const numberOfNights = this.resolveNumberOfNights(
      input.checkInDate,
      input.checkOutDate,
    );
    const roomItems = rooms.map((room) => {
      const allocation = guestAllocations.get(room.id)!;
      const childSurchargePerNight = allocation.childGuests.reduce(
        (total, child) => total + child.surchargePerNightSnapshot,
        0,
      );
      return {
        roomId: room.id,
        roomNumberSnapshot: room.roomNumber,
        roomTypeSnapshot: room.roomType,
        maxOccupancySnapshot: room.maxOccupancy,
        adultCount: allocation.adultCount,
        maxAdultsSnapshot: allocation.maxAdults,
        maxChildrenSnapshot: allocation.maxChildren,
        adultAgeFromSnapshot: allocation.adultAgeFrom,
        freeChildMaxAgeSnapshot: allocation.freeChildMaxAge,
        childSurchargePerNightSnapshot: allocation.childSurchargePerNight,
        childGuests: allocation.childGuests,
        pricePerNight: room.pricePerNight,
        currency: room.currency,
        numberOfNights,
        subtotal: this.roundMoney(
          (room.pricePerNight + childSurchargePerNight) * numberOfNights,
        ),
      };
    });
    const totalAmount = this.roundMoney(
      roomItems.reduce((total, room) => total + room.subtotal, 0),
    );
    const { commissionRate: appliedCommissionRate } = await this.bookingSettingsService.get();
    const holdMinutes = this.configService.getOrThrow<number>(
      'BOOKING_HOLD_MINUTES',
    );
    const idempotencyTtlHours = this.configService.getOrThrow<number>(
      'IDEMPOTENCY_KEY_TTL_HOURS',
    );

    const created = await this.repository.create(
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
          ...(tiers ? { inclusiveHourLimits: true as const } : {
            cancelHours: cancellationPolicy.cancelHours,
            penaltyPercent: cancellationPolicy.penaltyPercent,
            cancellationAllowed: cancellationPolicy.cancellationAllowed,
          }),
          policyName: cancellationPolicy.name,
          policyDescription: cancellationPolicy.description,
          timezone: 'Asia/Ho_Chi_Minh',
          checkInTime: hotel.checkInTime,
          rules: tiers ? tiers.map((tier, index) => ({
            id: `${cancellationPolicy.id}:${index}`,
            name: cancellationPolicy.name,
            minHoursAfterBooking: tiers[index - 1]?.upToHours ?? 0,
            maxHoursAfterBooking: tier.upToHours,
            cancellationAllowed: tier.feePercent !== null,
            cancellationFeeRate: tier.feePercent,
            description: null,
          })) : [{
            ...cancellationPolicy,
            minHoursAfterBooking: 0,
            maxHoursAfterBooking: null,
            cancellationFeeRate: cancellationPolicy.penaltyPercent,
          }],
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
      roomItems,
      {
        key: idempotencyKey,
        requestHash,
        expiresAt: new Date(Date.now() + idempotencyTtlHours * 3_600_000),
      },
    );
    if (!created.replayed) {
      await this.notify(
        created.booking,
        NotificationType.BOOKING_CREATED,
        'booking:' + created.booking.id + ':created',
        'Đã nhận yêu cầu đặt phòng',
        'Đơn đặt phòng ' +
          created.booking.bookingCode +
          ' đã được tạo và đang chờ thanh toán.',
      );
    }
    return created;
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
      roomGuests: input.roomGuests
        ?.map((allocation) => ({
          roomId: allocation.roomId,
          adultCount: allocation.adultCount,
          childAges: [...(allocation.childAges ?? [])].sort((left, right) => left - right),
        }))
        .sort((left, right) => left.roomId.localeCompare(right.roomId)),
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

  private async resolveGuestAllocations(
    hotelId: string,
    rooms: RoomEntity[],
    input: CreateBookingRequest,
  ): Promise<Map<string, {
    adultCount: number;
    maxAdults: number;
    maxChildren: number;
    adultAgeFrom: number;
    freeChildMaxAge: number;
    childSurchargePerNight: number;
    childGuests: Array<{ ageAtCheckIn: number; surchargePerNightSnapshot: number }>;
  }>> {
    const listPolicies = (this.roomsService as RoomsService & {
      listGuestPolicies?: (id: string) => Promise<RoomGuestPolicyEntity[]>;
    }).listGuestPolicies;
    const policies = listPolicies
      ? await listPolicies.call(this.roomsService, hotelId)
      : [];
    const policyByRoomType = new Map(
      policies.map((policy) => [this.normalizeRoomType(policy.roomType), policy]),
    );
    const policyFor = (room: RoomEntity) => {
      const configured = policyByRoomType.get(this.normalizeRoomType(room.roomType));
      return {
        maxAdults: Math.min(configured?.maxAdults ?? room.maxOccupancy, room.maxOccupancy),
        maxChildren: configured?.maxChildren ?? room.maxOccupancy,
        adultAgeFrom: configured?.adultAgeFrom ?? 12,
        freeChildMaxAge: configured?.freeChildMaxAge ?? 11,
        childSurchargePerNight: configured?.childSurchargePerNight ?? 0,
      };
    };

    let requested: RoomGuestAllocationRequest[] | undefined = input.roomGuests;
    if (!requested) {
      const totalCapacity = rooms.reduce((total, room) => total + room.maxOccupancy, 0);
      if (input.adultCount + input.childCount > totalCapacity) {
        throw new BookingCapacityExceededException();
      }
      if (input.childCount > 0) {
        throw new BookingGuestAllocationException(
          'Provide each child age and assign guests to each selected room.',
        );
      }
      let remainingAdults = input.adultCount;
      requested = rooms.map((room) => {
        const adultCount = Math.min(remainingAdults, policyFor(room).maxAdults);
        remainingAdults -= adultCount;
        return { roomId: room.id, adultCount, childAges: [] };
      });
      if (remainingAdults > 0) throw new BookingCapacityExceededException();
    }

    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const requestByRoom = new Map(requested.map((allocation) => [allocation.roomId, allocation]));
    if (
      requestByRoom.size !== rooms.length ||
      rooms.some((room) => !requestByRoom.has(room.id)) ||
      [...requestByRoom.keys()].some((roomId) => !roomById.has(roomId))
    ) {
      throw new BookingGuestAllocationException(
        'Guest allocation must include every selected room exactly once.',
      );
    }

    const adultTotal = requested.reduce((sum, allocation) => sum + allocation.adultCount, 0);
    const childTotal = requested.reduce((sum, allocation) => sum + (allocation.childAges?.length ?? 0), 0);
    if (adultTotal !== input.adultCount || childTotal !== input.childCount) {
      throw new BookingGuestAllocationException(
        'Per-room guest counts must match adultCount and childCount.',
      );
    }

    const result = new Map<string, {
      adultCount: number;
      maxAdults: number;
      maxChildren: number;
      adultAgeFrom: number;
      freeChildMaxAge: number;
      childSurchargePerNight: number;
      childGuests: Array<{ ageAtCheckIn: number; surchargePerNightSnapshot: number }>;
    }>();
    for (const allocation of requested) {
      const room = roomById.get(allocation.roomId)!;
      const policy = policyFor(room);
      const childAges = allocation.childAges ?? [];
      if (allocation.adultCount > policy.maxAdults) {
        throw new BookingGuestAllocationException(
          `Room ${room.roomNumber} allows at most ${policy.maxAdults} adults. Add another room or distribute the guests differently.`,
        );
      }
      if (childAges.length > policy.maxChildren) {
        throw new BookingGuestAllocationException(
          `Room ${room.roomNumber} allows at most ${policy.maxChildren} children.`,
        );
      }
      if (allocation.adultCount + childAges.length > room.maxOccupancy) {
        throw new BookingCapacityExceededException();
      }
      if (childAges.some((age) => age >= policy.adultAgeFrom)) {
        throw new BookingGuestAllocationException(
          `Guests aged ${policy.adultAgeFrom} or older must be counted as adults.`,
        );
      }
      result.set(room.id, {
        adultCount: allocation.adultCount,
        ...policy,
        childGuests: childAges.map((ageAtCheckIn) => ({
          ageAtCheckIn,
          surchargePerNightSnapshot:
            ageAtCheckIn > policy.freeChildMaxAge
              ? policy.childSurchargePerNight
              : 0,
        })),
      });
    }
    return result;
  }

  private normalizeRoomType(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');
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
      await this.hotelsService.assertManagedBy(booking.hotelId, actor, {
        requiresActiveHotel: true,
      });
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
            assessment.reason ?? 'Đơn đặt phòng không đủ điều kiện hủy theo chính sách đã xác nhận.',
          );
        }
        policy = assessment.rule;
      }
      this.recordCancellation(booking, policy);
      return booking;
    });
    if (!cancelled) throw new BookingNotFoundException(id);
    await this.notifyCancellation(cancelled);
    return cancelled;
  }

  private recordCancellation(booking: BookingEntity, policy: BookingCancellationRuleSnapshot | null): void {
    const feeRate = policy?.cancellationFeeRate ?? policy?.penaltyPercent ?? 0;
    const feeAmount = this.roundVnd(booking.amount * feeRate / 100);
    if (policy) {
      // Tier IDs live in the snapshot and are not foreign keys.
      if (!booking.cancellationPolicySnapshot?.inclusiveHourLimits && policy.id !== 'snapshot') {
        booking.cancellationPolicyId = policy.id;
      }
      booking.cancellationWindowSnapshot = policy.cancelHours ?? policy.maxHoursAfterBooking ??
        policy.maxHoursBeforeCheckIn ?? null;
    }
    booking.cancellationFeeRateSnapshot = feeRate;
    booking.cancellationDescriptionSnapshot = policy
      ? policy.description ?? policy.name
      : 'Hủy trước khi thanh toán; không phát sinh phí hủy.';
    booking.cancellationFeeAmount = feeAmount;
    booking.bookingStatus = BookingStatus.CANCELLED;
    booking.cancelledAt = new Date();
    const refundAmount = this.roundVnd(Math.max(0, booking.amount - feeAmount));
    booking.refundAmount = policy && booking.paymentStatus === PaymentStatus.PAID && refundAmount > 0
      ? refundAmount
      : null;
    booking.refundReason = booking.refundAmount === null
      ? null
      : `Khách hủy đơn đặt phòng theo chính sách: ${policy?.name ?? 'đã xác nhận'}`;
    booking.refundStatus = booking.refundAmount === null ? RefundStatus.NONE : RefundStatus.PENDING;
    booking.refundRequestedAt = booking.refundAmount === null ? null : booking.cancelledAt;
    booking.refundProcessingAt = null;
    booking.refundAttempt = booking.refundAmount === null ? 0 : 1;
    booking.refundFailureReason = null;
    booking.refundFailedAt = null;
    booking.refundHandledBy = null;
    this.queueAutomaticRefund(booking);
  }

  private async notifyCancellation(booking: BookingEntity): Promise<void> {
    await this.notify(
      booking,
      NotificationType.BOOKING_CANCELLED,
      `booking:${booking.id}:cancelled`,
      'Đơn đặt phòng đã được hủy',
      `Đơn đặt phòng ${booking.bookingCode} đã được hủy.`,
    );
  }

  async createPayosPaymentForActor(id: string, actor: AuthorizationActor) {
    this.assertCanModify(await this.findById(id), actor);
    if (!this.payos.isConfigured()) {
      throw new ServiceUnavailableException('Chưa cấu hình kênh thanh toán payOS.');
    }
    const payment = await this.repository.withLockedById(id, (booking) => {
      this.assertPayable(booking, 'create payOS payment');
      const now = new Date();
      if (booking.reservationExpiresAt <= now) throw new BookingReservationExpiredException();
      if (booking.paymentProvider && booking.paymentProvider !== PaymentProvider.PAYOS) {
        throw new ConflictException('Đơn đặt phòng này đã dùng cổng thanh toán cũ. Hãy tạo đơn đặt phòng mới để dùng payOS.');
      }
      if (booking.currency !== 'VND') throw new PayosCurrencyNotSupportedException();
      if (!Number.isSafeInteger(booking.amount) || booking.amount <= 0) throw new PayosAmountNotSupportedException();
      if (booking.paymentStatus === PaymentStatus.PENDING && !booking.paymentCreatedAt) {
        booking.paymentProvider = PaymentProvider.PAYOS;
        booking.paymentReference = String(randomInt(10_000_000_000_000, 100_000_000_000_000));
        booking.paymentMethod = PaymentMethod.QR;
        booking.paymentStatus = PaymentStatus.PAYMENT_PENDING;
        booking.paymentCreatedAt = now;
        booking.paymentExpiresAt = booking.reservationExpiresAt;
      }
      if (booking.paymentStatus !== PaymentStatus.PAYMENT_PENDING || !booking.paymentReference || !booking.paymentExpiresAt) {
        throw new BookingPaymentAlreadyInitializedException();
      }
      return {
        bookingId: booking.id,
        orderCode: Number(booking.paymentReference),
        amount: booking.amount,
        expiresAt: booking.paymentExpiresAt,
        checkoutUrl: booking.paymentCheckoutUrl,
      };
    });
    if (!payment) throw new BookingNotFoundException(id);
    if (payment.checkoutUrl) {
      return { bookingId: id, expiresAt: payment.expiresAt.toISOString(), paymentUrl: payment.checkoutUrl };
    }

    const link = await this.payos.createPayment(payment);
    const checkout = await this.repository.withLockedById(id, (booking) => {
      this.assertPayable(booking, 'open payOS payment');
      if (booking.reservationExpiresAt <= new Date()) throw new BookingReservationExpiredException();
      if (booking.paymentStatus !== PaymentStatus.PAYMENT_PENDING ||
          booking.paymentReference !== String(payment.orderCode) ||
          (booking.paymentLinkId && booking.paymentLinkId !== link.linkId)) {
        throw new BookingPaymentAlreadyInitializedException();
      }
      booking.paymentLinkId = link.linkId;
      booking.paymentCheckoutUrl = link.checkoutUrl;
      return { bookingId: id, expiresAt: payment.expiresAt.toISOString(), paymentUrl: link.checkoutUrl };
    });
    if (!checkout) throw new BookingNotFoundException(id);
    return checkout;
  }

  async handlePayosWebhook(body: unknown): Promise<void> {
    const event = await this.payos.verifyWebhook(body);
    if (!event) throw new UnauthorizedException('Chữ ký webhook payOS không hợp lệ.');
    const booking = await this.repository.findByPaymentReference(String(event.orderCode));
    if (!booking || booking.paymentProvider !== PaymentProvider.PAYOS ||
        (booking.paymentLinkId && booking.paymentLinkId !== event.linkId) ||
        booking.paymentStatus === PaymentStatus.PAID) return;
    const payment = await this.payos.getPayment(event.orderCode);
    if (payment.linkId === event.linkId) await this.applyPayosPayment(booking.id, payment);
  }

  async refreshPayosPaymentForActor(id: string, actor: AuthorizationActor): Promise<BookingEntity> {
    const booking = await this.findById(id);
    this.assertCanModify(booking, actor);
    const missingRefundDestination = this.canRecoverRefundDestination(booking);
    const needsVerification = booking.paymentStatus === PaymentStatus.PAYMENT_PENDING ||
      (booking.bookingStatus === BookingStatus.PENDING && booking.paymentStatus === PaymentStatus.FAILED) ||
      missingRefundDestination;
    if (booking.paymentProvider !== PaymentProvider.PAYOS ||
        !needsVerification || !booking.paymentLinkId || !booking.paymentReference) {
      return booking;
    }
    const payment = await this.payos.getPayment(Number(booking.paymentReference));
    if (missingRefundDestination) {
      return (await this.repository.withLockedById(id, (current) => {
        const paid = payment.paid;
        if (this.canRecoverRefundDestination(current) && paid?.destination &&
            current.paymentReference === String(payment.orderCode) && current.paymentLinkId === payment.linkId &&
            current.amount === payment.amount && current.amount === payment.amountPaid &&
            current.paymentTransactionId === 'PAYOS:' + paid.reference) {
          current.refundDestination = paid.destination;
          this.queueAutomaticRefund(current);
        }
        return current;
      })) ?? booking;
    }
    return (await this.applyPayosPayment(id, payment)) ?? booking;
  }

  private canRecoverRefundDestination(booking: BookingEntity): boolean {
    return booking.paymentProvider === PaymentProvider.PAYOS && booking.paymentStatus === PaymentStatus.PAID &&
      booking.bookingStatus === BookingStatus.CANCELLED && booking.settlementStatus === SettlementStatus.PENDING &&
      booking.refundStatus === RefundStatus.PENDING && (booking.refundAmount ?? 0) > 0 &&
      !booking.refundDestination && !booking.refundRequestId;
  }

  private async applyPayosPayment(id: string, payment: PayosPaymentInfo): Promise<BookingEntity | null> {
    const result = await this.repository.withLockedById(id, (booking) => {
      if (booking.paymentProvider !== PaymentProvider.PAYOS ||
          booking.paymentReference !== String(payment.orderCode) ||
          (booking.paymentLinkId && booking.paymentLinkId !== payment.linkId) ||
          booking.amount !== payment.amount || booking.paymentStatus === PaymentStatus.PAID) {
        return { booking, transition: null };
      }
      const transfer = payment.paid;
      if (!transfer) {
        if (payment.status === 'CANCELLED' && payment.amountPaid === 0 &&
            booking.bookingStatus === BookingStatus.PENDING) {
          booking.paymentStatus = PaymentStatus.FAILED;
          this.recordCancellation(booking, null);
          return { booking, transition: 'cancelled' };
        }
        if (booking.paymentStatus === PaymentStatus.PAYMENT_PENDING && payment.amountPaid === 0) {
          if (payment.status === 'EXPIRED') booking.paymentStatus = PaymentStatus.EXPIRED;
          if (['CANCELLED', 'FAILED'].includes(payment.status)) booking.paymentStatus = PaymentStatus.FAILED;
        }
        return { booking, transition: null };
      }
      // Some payOS bank transfers are timestamped to the minute, with seconds set to zero.
      const transferTime = transfer.at.getTime();
      const precisionMs = transferTime % 60_000 === 0 ? 60_000 : 1_000;
      if (!booking.paymentCreatedAt || transferTime < Math.floor(booking.paymentCreatedAt.getTime() / precisionMs) * precisionMs) {
        return { booking, transition: null };
      }
      booking.paymentLinkId = payment.linkId;
      booking.paymentStatus = PaymentStatus.PAID;
      booking.paymentTransactionId = 'PAYOS:' + transfer.reference;
      booking.refundDestination = transfer.destination;
      booking.paidAt = transfer.at;
      const now = new Date();
      if (booking.bookingStatus === BookingStatus.PENDING && booking.reservationExpiresAt <= now) {
        booking.bookingStatus = BookingStatus.CANCELLED;
        booking.cancelledAt = now;
        booking.cancellationFeeAmount = 0;
      }
      if (booking.bookingStatus === BookingStatus.CANCELLED) {
        booking.refundAmount = booking.amount;
        booking.refundReason = 'Thanh toán nhận được sau khi hủy hoặc hết thời gian giữ phòng.';
        booking.refundStatus = RefundStatus.PENDING;
        booking.refundRequestedAt = now;
        booking.refundAttempt = 1;
        this.queueAutomaticRefund(booking);
      } else if (booking.bookingStatus === BookingStatus.PENDING) {
        booking.bookingStatus = BookingStatus.CONFIRMED;
      }
      return { booking, transition: 'paid' };
    });
    if (!result) return null;
    if (result.transition === 'cancelled') await this.notifyCancellation(result.booking);
    if (result.transition === 'paid') {
      const booking = result.booking;
      await this.notify(booking, NotificationType.PAYMENT_SUCCEEDED,
        'booking:' + booking.id + ':payment-succeeded', 'Thanh toán thành công',
        'payOS xác nhận ' + this.formatVnd(booking.amount) + ' cho đơn đặt phòng ' + booking.bookingCode + '.');
      if (booking.bookingStatus === BookingStatus.CONFIRMED) {
        await this.notify(booking, NotificationType.BOOKING_CONFIRMED,
          'booking:' + booking.id + ':confirmed', 'Đơn đặt phòng đã được xác nhận',
          'Đơn đặt phòng ' + booking.bookingCode + ' đã được xác nhận.');
      }
    }
    return result.booking;
  }

  async refund(id: string, input: RefundBookingRequest, actor: AuthorizationActor): Promise<BookingEntity> {
    if (actor.role !== UserRole.ADMIN) throw new AuthorizationDeniedException();
    if (!this.payos.isPayoutConfigured()) throw new ServiceUnavailableException('Chưa cấu hình Kênh chi payOS.');
    const submission = await this.repository.withLockedById(id, (booking) => {
      if (booking.paymentStatus !== PaymentStatus.PAID) throw new BookingPaymentRequiredException('refund');
      if (booking.paymentProvider !== PaymentProvider.PAYOS || booking.bookingStatus !== BookingStatus.CANCELLED ||
          booking.settlementStatus !== SettlementStatus.PENDING) {
        throw new BookingActionNotAllowedException('refund through payOS');
      }
      if (!booking.refundDestination) throw new ConflictException('Giao dịch thiếu tài khoản người chuyển đã xác minh để hoàn qua payOS.');
      if (![RefundStatus.PENDING, RefundStatus.FAILED].includes(booking.refundStatus)) {
        throw new BookingRefundAlreadyInitializedException();
      }
      if (!Number.isSafeInteger(input.refundAmount) || input.refundAmount <= 0 ||
          input.refundAmount > booking.amount || booking.refundAmount !== input.refundAmount) {
        throw new RefundAmountExceededException();
      }
      booking.refundReason = input.refundReason;
      return this.beginPayosRefund(booking, input.refundAmount, booking.refundDestination, actor.id);
    });
    if (!submission) throw new BookingNotFoundException(id);

    return this.submitPayosRefund(id, submission);
  }

  private automaticRefundsEnabled(): boolean {
    return this.configService.get<boolean>('PAYOS_AUTO_REFUNDS_ENABLED') === true && this.payos.isPayoutConfigured();
  }

  private automaticRefundDetails(booking: BookingEntity): Omit<PayosRefundInput, 'requestId'> | null {
    const { refundAmount: amount, refundDestination: destination } = booking;
    if (booking.bookingStatus !== BookingStatus.CANCELLED || booking.paymentProvider !== PaymentProvider.PAYOS ||
        booking.paymentStatus !== PaymentStatus.PAID || booking.settlementStatus !== SettlementStatus.PENDING ||
        booking.currency !== 'VND' || amount === null || !Number.isSafeInteger(amount) || amount <= 0 || amount > booking.amount ||
        !destination || !/^\d{6}$/.test(destination.bank) || !/^\d{4,24}$/.test(destination.account)) return null;
    return { amount, destination };
  }

  private queueAutomaticRefund(booking: BookingEntity): void {
    if (booking.refundStatus === RefundStatus.PENDING && this.automaticRefundsEnabled() &&
        this.automaticRefundDetails(booking)) {
      booking.refundRequestId ??= randomUUID().replaceAll('-', '');
    }
  }

  async processAutomaticRefunds(): Promise<void> {
    if (this.processingRefunds || !this.payos.isPayoutConfigured()) return;
    this.processingRefunds = true;
    try {
      const checkBefore = new Date(Date.now() - REFUND_RECHECK_MS);
      const ids = await this.repository.findDueAutomaticRefundIds(checkBefore, REFUND_ITEMS_PER_POLL, this.automaticRefundsEnabled());
      for (const id of ids) {
        try {
          await this.processAutomaticRefund(id, checkBefore);
        } catch {
          this.logger.warn('Could not process an automatic refund. The next poll will check it again.');
        }
      }
    } catch {
      this.logger.warn('Could not load automatic refunds.');
    } finally {
      this.processingRefunds = false;
    }
  }

  private async processAutomaticRefund(id: string, checkBefore: Date): Promise<void> {
    const job = await this.repository.withLockedById(id, (booking) => {
      const details = this.automaticRefundDetails(booking);
      if (!details || !booking.refundRequestId || booking.refundHandledBy) return null;

      if (booking.refundStatus === RefundStatus.PENDING) {
        if (!this.automaticRefundsEnabled()) return null;
        return { submit: true, input: this.beginPayosRefund(booking, details.amount, details.destination, null) };
      }
      if (booking.refundStatus !== RefundStatus.PROCESSING || booking.updatedAt > checkBefore) return null;

      // Claim the next lookup under the row lock so two workers do not poll it together.
      booking.updatedAt = new Date();
      return { submit: false, input: { requestId: booking.refundRequestId, ...details } };
    });
    if (!job) return;
    if (job.submit) await this.submitPayosRefund(id, job.input);
    else await this.reconcilePayosRefund(id, job.input);
  }

  private beginPayosRefund(
    booking: BookingEntity,
    amount: number,
    destination: PayosRefundInput['destination'],
    handledBy: string | null,
  ): PayosRefundInput {
    const requestId = booking.refundStatus === RefundStatus.PENDING && booking.refundRequestId
      ? booking.refundRequestId
      : randomUUID().replaceAll('-', '');
    const now = new Date();
    booking.refundRequestId = requestId;
    booking.refundStatus = RefundStatus.PROCESSING;
    booking.refundRequestedAt ??= now;
    booking.refundProcessingAt = now;
    booking.refundHandledBy = handledBy;
    booking.refundAttempt = Math.max(1, booking.refundAttempt + Number(Boolean(booking.refundFailedAt)));
    booking.refundFailureReason = null;
    booking.refundFailedAt = null;
    return { requestId, amount, destination };
  }

  private async submitPayosRefund(id: string, submission: PayosRefundInput): Promise<BookingEntity> {
    let providerResult: PayosRefundResult;
    try {
      providerResult = await this.payos.refund(submission);
    } catch {
      // A lost response can still represent a submitted payout. Reconcile by the same reference.
      providerResult = { status: 'pending' };
    }
    const updated = await this.recordPayosRefundResult(id, submission, providerResult);
    if (updated.refundStatus === RefundStatus.PROCESSING) await this.notifyRefundStatus(updated);
    return updated;
  }

  async refreshPayosRefund(id: string, actor: AuthorizationActor): Promise<BookingEntity> {
    if (actor.role !== UserRole.ADMIN) throw new AuthorizationDeniedException();
    const booking = await this.findById(id);
    if (booking.paymentProvider !== PaymentProvider.PAYOS || booking.refundStatus !== RefundStatus.PROCESSING ||
        !booking.refundRequestId || !booking.refundDestination || !booking.refundAmount) return booking;
    const submission = {
      requestId: booking.refundRequestId,
      amount: booking.refundAmount,
      destination: booking.refundDestination,
    };
    return this.reconcilePayosRefund(id, submission);
  }

  private async reconcilePayosRefund(id: string, submission: PayosRefundInput): Promise<BookingEntity> {
    let providerResult: PayosRefundResult;
    try {
      providerResult = await this.payos.getRefund(submission);
    } catch {
      throw new ServiceUnavailableException('Chưa tra cứu được lệnh chi payOS. Vui lòng thử tra cứu lại.');
    }
    return this.recordPayosRefundResult(id, submission, providerResult);
  }

  private async recordPayosRefundResult(id: string, submission: PayosRefundInput, outcome: PayosRefundResult): Promise<BookingEntity> {
    const updated = await this.repository.withLockedById(id, (booking) => {
      if (booking.refundRequestId !== submission.requestId || booking.refundStatus !== RefundStatus.PROCESSING) {
        return { booking, changed: false };
      }
      if (outcome.status === 'succeeded' && outcome.reference) {
        booking.refundStatus = RefundStatus.REFUNDED;
        booking.refundTransactionId = 'PAYOS:' + outcome.reference;
        booking.refundedAt = new Date();
        booking.refundFailureReason = null;
      } else if (outcome.status === 'rejected') {
        booking.refundStatus = RefundStatus.FAILED;
        booking.refundFailedAt = new Date();
        booking.refundFailureReason = 'payOS xác nhận lệnh chi không thành công.';
      } else {
        booking.refundFailureReason = booking.refundHandledBy
          ? 'Chưa có kết quả cuối từ payOS. Hãy tra cứu lệnh chi trước khi xử lý tiếp.'
          : 'Chưa có kết quả cuối từ payOS. Hệ thống sẽ tiếp tục tra cứu theo mã lệnh đã lưu.';
      }
      return { booking, changed: booking.refundStatus !== RefundStatus.PROCESSING };
    });
    if (!updated) throw new BookingNotFoundException(id);
    if (updated.changed) await this.notifyRefundStatus(updated.booking);
    return updated.booking;
  }

  async confirmManualRefund(
    id: string,
    input: ConfirmManualRefundRequest,
    actor: AuthorizationActor,
  ): Promise<BookingEntity> {
    if (actor.role !== UserRole.ADMIN) throw new AuthorizationDeniedException();

    const updated = await this.repository.withLockedById(id, (booking) => {
      if (booking.paymentProvider !== PaymentProvider.LEGACY_LIVE) {
        throw new BookingActionNotAllowedException('record a historical refund');
      }
      if (booking.paymentStatus !== PaymentStatus.PAID) {
        throw new BookingPaymentRequiredException('recording a refund');
      }
      if (booking.refundStatus === RefundStatus.REFUNDED) {
        if (booking.refundTransactionId === input.refundTransactionId && booking.refundAmount === input.refundAmount) {
          return booking;
        }
        throw new BookingAlreadyRefundedException();
      }
      if (
        booking.refundStatus !== RefundStatus.PENDING ||
        booking.settlementStatus !== SettlementStatus.PENDING ||
        booking.refundAmount === null ||
        booking.refundAmount <= 0 ||
        !booking.refundReason
      ) {
        throw new BookingActionNotAllowedException('confirm a pending manual refund');
      }
      if (booking.refundAmount !== input.refundAmount) {
        throw new ConflictException('The confirmed amount must match the pending refund amount.');
      }

      const confirmedAt = new Date();
      booking.refundStatus = RefundStatus.REFUNDED;
      booking.refundTransactionId = input.refundTransactionId;
      booking.refundedAt = confirmedAt;
      booking.refundProcessingAt ??= confirmedAt;
      booking.refundHandledBy = actor.id;
      booking.refundFailureReason = null;
      booking.refundFailedAt = null;
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
        `Yêu cầu hoàn ${amount} cho đơn đặt phòng ${booking.bookingCode} đang chờ payOS xác nhận.`,
      );
    } else if (booking.refundStatus === RefundStatus.REFUNDED) {
      const manual = booking.paymentProvider === PaymentProvider.LEGACY_LIVE;
      await this.notify(
        booking,
        NotificationType.REFUND_SUCCEEDED,
        `booking:${booking.id}:refund:${booking.refundAttempt}:succeeded`,
        manual ? 'Đã xác nhận hoàn tiền' : 'payOS đã xác nhận hoàn tiền',
        manual
          ? `Quản trị viên đã xác nhận hoàn ${amount} cho đơn đặt phòng ${booking.bookingCode} qua chuyển khoản.`
          : `payOS xác nhận hoàn ${amount} cho đơn đặt phòng ${booking.bookingCode} thành công.`,
      );
    } else if (booking.refundStatus === RefundStatus.FAILED) {
      const reason = booking.refundFailureReason ? ` Lý do: ${booking.refundFailureReason}` : '';
      await this.notify(
        booking,
        NotificationType.REFUND_FAILED,
        `booking:${booking.id}:refund:${booking.refundAttempt}:failed`,
        'Hoàn tiền chưa thành công',
        `Yêu cầu hoàn ${amount} cho đơn đặt phòng ${booking.bookingCode} chưa thành công.${reason}`,
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
      }, booking.guestEmail);
    } catch {
      this.logger.error(
        `Failed to persist booking notification (${type}).`,
      );
    }
  }

  private formatVnd(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
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
