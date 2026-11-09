import { ConfigService } from '@nestjs/config';
import { HotelsService } from '../../hotels/services/hotels.service';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { UserRole } from '../../users/entities/user.entity';
import { CancellationPoliciesService } from '../../cancellation-policies/services/cancellation-policies.service';
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
  BookingPolicyHotelMismatchException,
  BookingRoomNotOperationalException,
  BookingReservationExpiredException,
  InvalidBookingStayException,
  InvalidBookingTransitionException,
  RefundAmountExceededException,
} from '../exceptions/booking.exceptions';
import type { BookingCodeGenerator } from '../interfaces/booking-code-generator.interface';
import type { BookingRepository } from '../interfaces/booking.repository.interface';
import type { VnpayPaymentGateway } from '../interfaces/vnpay-payment-gateway.interface';
import { BookingsService } from './bookings.service';

const bookingId = '11111111-1111-4111-8111-111111111111';
const hotelId = '22222222-2222-4222-8222-222222222222';
const touristId = '33333333-3333-4333-8333-333333333333';
const policyId = '44444444-4444-4444-8444-444444444444';
const roomId = '55555555-5555-4555-8555-555555555555';
const idempotencyKey = '66666666-6666-4666-8666-666666666666';

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
  roomIds: [roomId],
  checkInDate: '2026-12-01',
  checkOutDate: '2026-12-03',
  adultCount: 2,
  childCount: 0,
  guestName: 'Nguyen Van A',
  guestEmail: 'guest@example.com',
  guestPhone: '0912345678',
  cancellationPolicyId: policyId,
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
    cancellationPolicyId: policyId,
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
  let vnpayGateway: jest.Mocked<VnpayPaymentGateway>;
  let cancellationPoliciesService: jest.Mocked<
    Pick<CancellationPoliciesService, 'findById'>
  >;
  let roomsService: jest.Mocked<Pick<RoomsService, 'findEntitiesByIds'>>;
  let hotelsService: jest.Mocked<
    Pick<HotelsService, 'assertActive' | 'assertManagedBy'>
  >;
  let service: BookingsService;
  let createBooking: jest.MockedFunction<BookingRepository['create']>;
  let withLockedById: jest.MockedFunction<BookingRepository['withLockedById']>;

  beforeEach(() => {
    createBooking = jest.fn();
    withLockedById = jest.fn();
    repository = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findPage: jest.fn(),
      create: createBooking,
      save: jest.fn(),
      withLockedById,
    };
    codeGenerator = { generate: jest.fn() };
    vnpayGateway = {
      createPaymentUrl: jest.fn(),
      verifyPaymentCallback: jest.fn(),
      refund: jest.fn(),
    };
    cancellationPoliciesService = { findById: jest.fn() };
    roomsService = { findEntitiesByIds: jest.fn() };
    hotelsService = { assertActive: jest.fn(), assertManagedBy: jest.fn() };
    service = new BookingsService(
      repository,
      codeGenerator,
      vnpayGateway,
      cancellationPoliciesService as unknown as CancellationPoliciesService,
      roomsService as unknown as RoomsService,
      new ConfigService({
        BOOKING_COMMISSION_RATE: 15,
        BOOKING_HOLD_MINUTES: 15,
        IDEMPOTENCY_KEY_TTL_HOURS: 24,
      }),
      hotelsService as unknown as HotelsService,
    );
  });

  it('creates a booking with generated code and initial states', async () => {
    const saved = booking();
    codeGenerator.generate.mockReturnValue('BK-20261104-ABCDEF1234');
    cancellationPoliciesService.findById.mockResolvedValue({
      hotelId,
      cancellationWindow: 24,
      cancellationFeeRate: 20,
      description: 'Cancel before 24 hours',
    } as never);
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

  it('rejects a cancellation policy from another hotel', async () => {
    cancellationPoliciesService.findById.mockResolvedValue({
      hotelId: '55555555-5555-4555-8555-555555555555',
    } as never);
    roomsService.findEntitiesByIds.mockResolvedValue([room()]);

    await expect(
      service.create(touristId, createInput({ adultCount: 1 }), idempotencyKey),
    ).rejects.toBeInstanceOf(BookingPolicyHotelMismatchException);
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

  it('creates one VNPAY payment URL without choosing the method upfront', async () => {
    const existing = booking();
    repository.withLockedById.mockImplementation(async (_id, operation) =>
      operation(existing),
    );
    vnpayGateway.createPaymentUrl.mockReturnValue(
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?signed=1',
    );

    const result = await service.createVnpayPayment(
      bookingId,
      { locale: 'vn' },
      '127.0.0.1',
    );

    expect(result.paymentUrl).toContain('sandbox.vnpayment.vn');
    expect(existing.paymentMethod).toBeNull();
    expect(existing.paymentStatus).toBe(PaymentStatus.PAYMENT_PENDING);
    expect(existing.paymentCreatedAt).toBeInstanceOf(Date);
    expect(
      existing.paymentExpiresAt!.getTime() -
        existing.paymentCreatedAt!.getTime(),
    ).toBe(15 * 60 * 1000);
  });

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
      service.createVnpayPayment(bookingId, { locale: 'vn' }, '127.0.0.1'),
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
      service.createVnpayPayment(bookingId, { locale: 'vn' }, '127.0.0.1'),
    ).rejects.toBeInstanceOf(BookingReservationExpiredException);
  });

  it('confirms a booking only from a valid successful VNPAY IPN', async () => {
    const existing = booking({
      paymentMethod: null,
      paymentStatus: PaymentStatus.PAYMENT_PENDING,
      paymentCreatedAt: new Date(),
      paymentExpiresAt: new Date(Date.now() + 60_000),
    });
    vnpayGateway.verifyPaymentCallback.mockReturnValue({
      signatureValid: true,
      terminalCodeValid: true,
      bookingId,
      amount: 1_000_000,
      responseCode: '00',
      transactionStatus: '00',
      transactionId: '14567890',
      cardType: 'QRCODE',
      bankCode: 'NCB',
      paidAt: new Date('2026-11-04T01:00:00.000Z'),
    });
    repository.withLockedById.mockImplementation(async (_id, operation) =>
      operation(existing),
    );

    await expect(service.handleVnpayIpn({})).resolves.toEqual({
      RspCode: '00',
      Message: 'Confirm Success',
    });
    expect(existing.paymentStatus).toBe(PaymentStatus.PAID);
    expect(existing.paymentMethod).toBe(PaymentMethod.QR);
    expect(existing.bookingStatus).toBe(BookingStatus.CONFIRMED);
    expect(existing.paymentTransactionId).toBe('14567890');
  });

  it.each([
    ['CREDIT', 'VISA', PaymentMethod.CARD],
    ['ATM', 'NCB', PaymentMethod.BANK_TRANSFER],
  ])(
    'maps VNPAY card type %s and bank code %s to %s',
    async (cardType, bankCode, expectedMethod) => {
      const existing = booking({
        paymentStatus: PaymentStatus.PAYMENT_PENDING,
        paymentCreatedAt: new Date(),
        paymentExpiresAt: new Date(Date.now() + 60_000),
      });
      vnpayGateway.verifyPaymentCallback.mockReturnValue({
        signatureValid: true,
        terminalCodeValid: true,
        bookingId,
        amount: 1_000_000,
        responseCode: '00',
        transactionStatus: '00',
        transactionId: '14567890',
        cardType,
        bankCode,
        paidAt: new Date('2026-11-04T01:00:00.000Z'),
      });
      repository.withLockedById.mockImplementation(async (_id, operation) =>
        operation(existing),
      );

      await service.handleVnpayIpn({});

      expect(existing.paymentMethod).toBe(expectedMethod);
    },
  );

  it('rejects an IPN with an invalid signature without loading a booking', async () => {
    vnpayGateway.verifyPaymentCallback.mockReturnValue({
      signatureValid: false,
      terminalCodeValid: true,
      bookingId,
      amount: 1_000_000,
      responseCode: '00',
      transactionStatus: '00',
      transactionId: '14567890',
      cardType: 'QRCODE',
      bankCode: 'NCB',
      paidAt: new Date(),
    });

    await expect(service.handleVnpayIpn({})).resolves.toEqual({
      RspCode: '97',
      Message: 'Invalid signature',
    });
    expect(withLockedById).not.toHaveBeenCalled();
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

  it('records one successful VNPAY refund', async () => {
    const existing = booking({
      bookingStatus: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.QR,
      paymentTransactionId: '14567890',
      paymentCreatedAt: new Date('2026-11-04T00:30:00.000Z'),
    });
    repository.withLockedById.mockImplementation(async (_id, operation) =>
      operation(existing),
    );
    vnpayGateway.refund.mockResolvedValue({
      requestId: 'request-1',
      responseCode: '00',
      transactionStatus: '00',
      transactionId: '987654321',
      payDate: new Date('2026-11-04T02:00:00.000Z'),
    });

    const result = await service.refund(
      bookingId,
      { refundAmount: 250_000, refundReason: 'Customer cancellation' },
      '127.0.0.1',
    );

    expect(result.refundStatus).toBe(RefundStatus.REFUNDED);
    expect(result.refundTransactionId).toBe('987654321');
    expect(result.bookingStatus).toBe(BookingStatus.CANCELLED);
  });
});
