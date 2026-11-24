import { ConfigService } from '@nestjs/config';
import { HotelsService } from '../../hotels/services/hotels.service';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { UserRole } from '../../users/entities/user.entity';
import { CancellationPoliciesService } from '../../cancellation-policies/services/cancellation-policies.service';
import { CancellationPolicyChangedException } from '../../cancellation-policies/exceptions/cancellation-policy.exceptions';
import { NotificationType } from '../../notifications/entities/notification.entity';
import type { NotificationsService } from '../../notifications/services/notifications.service';
import {
  RoomOperationalStatus,
  RoomEntity,
} from '../../rooms/entities/room.entity';
import { RoomsService } from '../../rooms/services/rooms.service';
import type { CreateBookingRequest } from '../dtos/requests/create-booking.request';
import {
  BookingEntity,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  SettlementStatus,
} from '../entities/booking.entity';
import {
  BookingCapacityExceededException,
  BookingPaymentAlreadyInitializedException,
  BookingPaymentRequiredException,
  BookingRoomNotOperationalException,
  BookingReservationExpiredException,
  InvalidBookingStayException,
  InvalidBookingTransitionException,
  RefundAmountExceededException,
} from '../exceptions/booking.exceptions';
import type { BookingCodeGenerator } from '../interfaces/booking-code-generator.interface';
import type { BookingRepository } from '../interfaces/booking.repository.interface';
import type { SePayV2Client } from '../interfaces/sepay-v2.interface';
import { BookingsService } from './bookings.service';

const bookingId = '11111111-1111-4111-8111-111111111111';
const hotelId = '22222222-2222-4222-8222-222222222222';
const touristId = '33333333-3333-4333-8333-333333333333';
const policyId = '44444444-4444-4444-8444-444444444444';
const roomId = '55555555-5555-4555-8555-555555555555';
const idempotencyKey = '66666666-6666-4666-8666-666666666666';
const cancellationPolicyVersion = 'a'.repeat(64);

const room = (overrides: Partial<RoomEntity> = {}): RoomEntity =>
  Object.assign(new RoomEntity(), {
    id: roomId,
    hotelId,
    roomNumber: 'A101',
    maxOccupancy: 3,
    pricePerNight: 500_000,
    currency: 'VND',
    description: null,
    operationalStatus: RoomOperationalStatus.AVAILABLE,
    roomType: 'DELUXE',
    createdAt: new Date('2026-11-04T00:00:00.000Z'),
    updatedAt: new Date('2026-11-04T00:00:00.000Z'),
    ...overrides,
  });

const createInput = (
  overrides: Partial<CreateBookingRequest> = {},
): CreateBookingRequest => ({
  cancellationPolicyVersion,
  roomIds: [roomId],
  checkInDate: '2026-12-01',
  checkOutDate: '2026-12-03',
  adultCount: 2,
  childCount: 0,
  guestName: 'Nguyen Van A',
  guestEmail: 'guest@example.com',
  guestPhone: '0912345678',
  ...overrides,
});

const booking = (overrides: Partial<BookingEntity> = {}): BookingEntity =>
  Object.assign(new BookingEntity(), {
    id: bookingId,
    hotelId,
    touristId,
    bookingCode: 'BK-20261104-ABCDEF1234',
    createdAt: new Date('2026-11-04T00:00:00.000Z'),
    updatedAt: new Date('2026-11-04T00:00:00.000Z'),
    checkInDate: '2026-12-01',
    checkOutDate: '2026-12-03',
    adultCount: 2,
    childCount: 0,
    guestName: 'Nguyen Van A',
    guestEmail: 'guest@example.com',
    guestPhone: '0912345678',
    specialRequests: null,
    bookingStatus: BookingStatus.PENDING,
    cancelledAt: null,
    reservationExpiresAt: new Date('2099-12-03T00:00:00.000Z'),
    totalAmount: 1_000_000,
    currency: 'VND',
    appliedCommissionRate: 15,
    amount: 1_000_000,
    paymentMethod: null,
    paymentCreatedAt: null,
    paymentExpiresAt: null,
    paymentStatus: PaymentStatus.PENDING,
    paidAt: null,
    paymentTransactionId: null,
    settlementBaseAmount: null,
    commissionAmount: null,
    partnerReceivableAmount: null,
    settlementStatus: SettlementStatus.PENDING,
    transactionId: null,
    bankNameSnapshot: null,
    bankAccountNumberSnapshot: null,
    bankAccountHolderSnapshot: null,
    settledAt: null,
    cancellationPolicyId: null,
    cancellationWindowSnapshot: 24,
    cancellationFeeRateSnapshot: 20,
    cancellationDescriptionSnapshot: 'Cancel before 24 hours',
    refundAmount: null,
    refundReason: null,
    refundStatus: RefundStatus.NONE,
    refundedAt: null,
    refundTransactionId: null,
    roomItems: [],
    ...overrides,
  });

describe('BookingsService', () => {
  let repository: jest.Mocked<BookingRepository>;
  let codeGenerator: jest.Mocked<BookingCodeGenerator>;
  let sepayGateway: jest.Mocked<SePayV2Client>;
  let cancellationPoliciesService: jest.Mocked<
    Pick<CancellationPoliciesService, 'getCompleteScheduleForBooking'>
  >;
  let roomsService: jest.Mocked<Pick<RoomsService, 'findEntitiesByIds'>>;
  let hotelsService: jest.Mocked<
    Pick<HotelsService, 'assertActive' | 'assertManagedBy'>
  >;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'createOnce'>>;
  let service: BookingsService;
  let createBooking: jest.MockedFunction<BookingRepository['create']>;
  let withLockedById: jest.MockedFunction<BookingRepository['withLockedById']>;

  beforeEach(() => {
    createBooking = jest.fn();
    withLockedById = jest.fn();
    repository = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findBySePayOrderCode: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findPage: jest.fn(),
      create: createBooking,
      save: jest.fn(),
      withLockedById,
    };
    codeGenerator = { generate: jest.fn() };
    sepayGateway = {
      createOrder: jest.fn(),
      refundOrder: jest.fn(),
      getRefund: jest.fn(),
      verifyWebhook: jest.fn().mockReturnValue(true),
    };
    cancellationPoliciesService = { getCompleteScheduleForBooking: jest.fn() };
    roomsService = { findEntitiesByIds: jest.fn() };
    hotelsService = {
      assertActive: jest.fn().mockResolvedValue({ id: hotelId, checkInTime: '14:00' }),
      assertManagedBy: jest.fn(),
    };
    cancellationPoliciesService.getCompleteScheduleForBooking.mockResolvedValue({
      hotelId,
      version: cancellationPolicyVersion,
      complete: true,
      issue: null,
      rules: [{
        id: policyId,
        name: 'Standard',
        cancelHours: 24,
        penaltyPercent: 20,
        cancellationAllowed: true,
        description: 'Cancel before 24 hours',
      }],
    });
    notificationsService = { createOnce: jest.fn() };
    service = new BookingsService(
      repository,
      codeGenerator,
      sepayGateway,
      cancellationPoliciesService as unknown as CancellationPoliciesService,
      roomsService as unknown as RoomsService,
      new ConfigService({
        BOOKING_COMMISSION_RATE: 15,
        BOOKING_HOLD_MINUTES: 15,
        IDEMPOTENCY_KEY_TTL_HOURS: 24,
      }),
      hotelsService as unknown as HotelsService,
      notificationsService as unknown as NotificationsService,
    );
  });

  it('creates a booking with generated code and initial states', async () => {
    const saved = booking();
    codeGenerator.generate.mockReturnValue('BK-20261104-ABCDEF1234');
    roomsService.findEntitiesByIds.mockResolvedValue([room()]);
    createBooking.mockResolvedValue({ booking: saved, replayed: false });

    await expect(
      service.create(
        touristId,
        createInput({
          guestName: ' Nguyen Van A ',
          guestEmail: ' Guest@Example.com ',
        }),
        idempotencyKey,
      ),
    ).resolves.toEqual({ booking: saved, replayed: false });

    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingStatus: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        settlementStatus: SettlementStatus.PENDING,
        refundStatus: RefundStatus.NONE,
        totalAmount: 1_000_000,
        amount: 1_000_000,
        guestEmail: 'guest@example.com',
      }),
      [
        expect.objectContaining({
          roomId,
          numberOfNights: 2,
          subtotal: 1_000_000,
        }),
      ],
      expect.objectContaining({
        key: idempotencyKey,
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it('returns the original booking when the same request is replayed', async () => {
    const saved = booking();
    repository.findByIdempotencyKey.mockResolvedValue(saved);

    await expect(
      service.create(touristId, createInput(), idempotencyKey),
    ).resolves.toEqual({ booking: saved, replayed: true });
    expect(roomsService.findEntitiesByIds).not.toHaveBeenCalled();
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('rejects a booking when the cancellation policy changed after it was displayed', async () => {
    cancellationPoliciesService.getCompleteScheduleForBooking.mockRejectedValue(
      new CancellationPolicyChangedException(),
    );
    roomsService.findEntitiesByIds.mockResolvedValue([room()]);

    await expect(
      service.create(touristId, createInput({ adultCount: 1 }), idempotencyKey),
    ).rejects.toBeInstanceOf(CancellationPolicyChangedException);
  });

  it('rejects a checkout date that is not later than check-in', async () => {
    roomsService.findEntitiesByIds.mockResolvedValue([room()]);

    await expect(
      service.create(
        touristId,
        createInput({ checkInDate: '2026-12-03', checkOutDate: '2026-12-03' }),
        idempotencyKey,
      ),
    ).rejects.toBeInstanceOf(InvalidBookingStayException);
  });

  it('rejects a guest count above the selected room capacity', async () => {
    roomsService.findEntitiesByIds.mockResolvedValue([
      room({ maxOccupancy: 2 }),
    ]);

    await expect(
      service.create(
        touristId,
        createInput({ adultCount: 2, childCount: 1 }),
        idempotencyKey,
      ),
    ).rejects.toBeInstanceOf(BookingCapacityExceededException);
  });

  it('rejects a room that is not operationally available', async () => {
    roomsService.findEntitiesByIds.mockResolvedValue([
      room({ operationalStatus: RoomOperationalStatus.MAINTENANCE }),
    ]);

    await expect(
      service.create(touristId, createInput(), idempotencyKey),
    ).rejects.toBeInstanceOf(BookingRoomNotOperationalException);
  });

  it('rejects a transition from cancelled to confirmed', async () => {
    repository.findById.mockResolvedValue(
      booking({ bookingStatus: BookingStatus.CANCELLED }),
    );

    await expect(
      service.update(bookingId, { bookingStatus: BookingStatus.CONFIRMED }),
    ).rejects.toBeInstanceOf(InvalidBookingTransitionException);
  });

  it('does not expose a booking to another tourist', async () => {
    repository.findById.mockResolvedValue(booking());

    await expect(
      service.findByIdForActor(bookingId, {
        id: '99999999-9999-4999-8999-999999999999',
        role: UserRole.TOURIST,
      }),
    ).rejects.toBeInstanceOf(AuthorizationDeniedException);
  });

  it('does not manually confirm an unpaid booking', async () => {
    repository.findById.mockResolvedValue(booking());

    await expect(
      service.update(bookingId, { bookingStatus: BookingStatus.CONFIRMED }),
    ).rejects.toBeInstanceOf(BookingPaymentRequiredException);
  });

  it('allows a tourist to cancel an unpaid pending booking without a fee', async () => {
    const existing = booking({
      bookingStatus: BookingStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
    });
    repository.findById.mockResolvedValue(existing);
    repository.withLockedById.mockImplementation(async (_id, operation) =>
      operation(existing),
    );

    const result = await service.cancelForActor(bookingId, {
      id: touristId,
      role: UserRole.TOURIST,
    });

    expect(result.bookingStatus).toBe(BookingStatus.CANCELLED);
    expect(result.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(result.cancellationFeeAmount).toBe(0);
    expect(result.refundAmount).toBeNull();
    expect(result.refundStatus).toBe(RefundStatus.NONE);
    expect(notificationsService.createOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: touristId,
        type: NotificationType.BOOKING_CANCELLED,
        eventKey: `booking:${bookingId}:cancelled`,
      }),
    );
  });

  it('creates and stores one SePay v2 VA order', async () => {
    const existing = booking()
    repository.withLockedById.mockImplementation(async (_id, operation) => operation(existing))
    sepayGateway.createOrder.mockImplementation(async input => ({
      id: 'order-v2-uuid', order_code: input.orderCode, amount: input.amount,
      status: 'Pending', va_number: 'SBSEPAY123456',
      qr_code_url: 'https://example.test/qr', bank_name: 'Sandbox Bank',
      account_number: '123456789', account_holder_name: 'SANDBOX',
    }))
    const result = await service.createSePayPayment(bookingId)
    expect(result.booking.sepayOrderXid).toBe('order-v2-uuid')
    expect(result.booking.sepayVaNumber).toBe('SBSEPAY123456')
    expect(result.booking.paymentMethod).toBe(PaymentMethod.BANK_TRANSFER)
    expect(result.booking.paymentStatus).toBe(PaymentStatus.PAYMENT_PENDING)
    expect(result.booking.paymentCreatedAt).toBeInstanceOf(Date)
  })
  it('rejects a second payment initialization', async () => {
    const existing = booking({
      paymentStatus: PaymentStatus.PAYMENT_PENDING,
      paymentMethod: null,
      paymentCreatedAt: new Date(),
      paymentExpiresAt: new Date(Date.now() + 60_000),
    });
    repository.withLockedById.mockImplementation(async (_id, operation) =>
      operation(existing),
    );

    await expect(
      service.createSePayPayment(bookingId),
    ).rejects.toBeInstanceOf(BookingPaymentAlreadyInitializedException);
  });

  it('rejects payment initialization after the room hold expires', async () => {
    const existing = booking({
      reservationExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    repository.withLockedById.mockImplementation(async (_id, operation) =>
      operation(existing),
    );

    await expect(
      service.createSePayPayment(bookingId),
    ).rejects.toBeInstanceOf(BookingReservationExpiredException);
  });

  it('confirms a booking only from a matching SePay v2 payment webhook', async () => {
    const existing = booking({
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentStatus: PaymentStatus.PAYMENT_PENDING,
      paymentCreatedAt: new Date(),
      paymentExpiresAt: new Date(Date.now() + 60_000),
      sepayOrderCode: 'BKTEST12345678',
      sepayVaNumber: 'SBSEPAY123456',
    })
    repository.findBySePayOrderCode.mockResolvedValue(existing)
    repository.withLockedById.mockImplementation(async (_id, operation) => operation(existing))
    const payload = {
      id: 14567890, code: 'BKTEST12345678', transferType: 'in',
      transferAmount: 1_000_000, transactionDate: '2026-11-04 10:30:00',
      subAccount: 'SBSEPAY123456',
    };
    await expect(service.handleSePayV2Webhook(payload)).resolves.toBe(true)
    expect(existing.paymentStatus).toBe(PaymentStatus.PAID)
    expect(existing.paymentMethod).toBe(PaymentMethod.BANK_TRANSFER)
    expect(existing.bookingStatus).toBe(BookingStatus.CONFIRMED)
    expect(existing.paymentTransactionId).toBe('14567890')
    expect(notificationsService.createOnce).toHaveBeenCalledTimes(2);
    expect(notificationsService.createOnce).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: touristId,
        type: NotificationType.PAYMENT_SUCCEEDED,
        eventKey: `booking:${bookingId}:payment-succeeded`,
      }),
    );
    expect(notificationsService.createOnce).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: touristId,
        type: NotificationType.BOOKING_CONFIRMED,
        eventKey: `booking:${bookingId}:confirmed`,
      }),
    );

    await expect(service.handleSePayV2Webhook(payload)).resolves.toBe(true);
    expect(notificationsService.createOnce).toHaveBeenCalledTimes(2);
  })

  it('automatically refunds a SePay payment received after the booking was cancelled', async () => {
    const existing = booking({
      bookingStatus: BookingStatus.CANCELLED,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentStatus: PaymentStatus.PAYMENT_PENDING,
      paymentCreatedAt: new Date(),
      paymentExpiresAt: new Date(Date.now() + 60_000),
      cancelledAt: new Date(),
      sepayOrderXid: 'order-v2-uuid',
      sepayOrderCode: 'BKTEST12345678',
      sepayVaNumber: 'SBSEPAY123456',
    });
    repository.findBySePayOrderCode.mockResolvedValue(existing);
    repository.withLockedById.mockImplementation(async (_id, operation) =>
      operation(existing),
    );
    sepayGateway.refundOrder.mockResolvedValue({
      refund_id: 'RF-LATE-PAYMENT',
      status: 'succeeded',
      amount: existing.amount,
    });
    const payload = {
      id: 14567891,
      code: 'BKTEST12345678',
      transferType: 'in',
      transferAmount: 1_000_000,
      transactionDate: '2026-11-04 10:30:00',
      subAccount: 'SBSEPAY123456',
    };

    await expect(service.handleSePayV2Webhook(payload)).resolves.toBe(true);

    expect(existing.bookingStatus).toBe(BookingStatus.CANCELLED);
    expect(existing.paymentStatus).toBe(PaymentStatus.PAID);
    expect(existing.refundAmount).toBe(existing.amount);
    expect(existing.refundStatus).toBe(RefundStatus.REFUNDED);
    expect(existing.refundTransactionId).toBe('RF-LATE-PAYMENT');
    expect(sepayGateway.refundOrder).toHaveBeenCalledWith(
      'order-v2-uuid',
      existing.amount,
      expect.stringContaining(`refund-${bookingId.replaceAll('-', '')}`),
    );
  });

  it('calculates commission and partner receivable during settlement', async () => {
    const existing = booking({ paymentStatus: PaymentStatus.PAID });
    repository.findById.mockResolvedValue(existing);
    repository.save.mockImplementation(async (value) => value);

    const result = await service.settle(bookingId, {
      settlementBaseAmount: 1_000_000,
      transactionId: 'SETTLE-001',
      bankNameSnapshot: 'Example Bank',
      bankAccountNumberSnapshot: '123456789',
      bankAccountHolderSnapshot: 'NGUYEN VAN A',
    });

    expect(result.commissionAmount).toBe(150_000);
    expect(result.partnerReceivableAmount).toBe(850_000);
    expect(result.settlementStatus).toBe(SettlementStatus.SETTLED);
  });

  it('rejects a refund larger than the customer payment', async () => {
    const existing = booking({
      paymentStatus: PaymentStatus.PAID,
      paymentTransactionId: '14567890',
      paymentCreatedAt: new Date(),
      sepayOrderXid: 'order-v2-uuid',
    });
    repository.withLockedById.mockImplementation(async (_id, operation) =>
      operation(existing),
    );

    await expect(
      service.refund(
        bookingId,
        { refundAmount: 1_000_000.01, refundReason: 'Cancellation' },
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(RefundAmountExceededException);
  });

  it('sends a booking refund to SePay v2 and stores its provider reference', async () => {
    const existing = booking({
      bookingStatus: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentTransactionId: '14567890',
      paymentCreatedAt: new Date('2026-11-04T00:30:00.000Z'),
      sepayOrderXid: 'order-v2-uuid',
    })
    repository.withLockedById.mockImplementation(async (_id, operation) => operation(existing))
    sepayGateway.refundOrder.mockResolvedValue({
      refund_id: 'RF-TEST-123456', status: 'pending', amount: 250_000,
    })
    const result = await service.refund(
      bookingId,
      { refundAmount: 250_000, refundReason: 'Customer cancellation' },
      '127.0.0.1',
    )
    expect(result.refundStatus).toBe(RefundStatus.PROCESSING)
    expect(result.refundTransactionId).toBe('RF-TEST-123456')
    expect(sepayGateway.refundOrder).toHaveBeenCalledWith(
      'order-v2-uuid', 250_000, expect.stringContaining('refund-'),
    )
  });
});
