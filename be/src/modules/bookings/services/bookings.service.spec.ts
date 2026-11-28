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
  PaymentProvider,
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
} from '../exceptions/booking.exceptions';
import type { BookingCodeGenerator } from '../interfaces/booking-code-generator.interface';
import type { BookingRepository } from '../interfaces/booking.repository.interface';
import type { BookingSettingsRepository } from '../interfaces/booking-settings.repository.interface';
import type { PayosGateway } from '../interfaces/payos-gateway.interface';
import { BookingSettingsService } from './booking-settings.service';
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
    refundRequestId: null,
    refundDestination: null,
    refundHandledBy: null,
    refundedAt: null,
    refundTransactionId: null,
    roomItems: [],
    ...overrides,
  });

describe('BookingsService', () => {
  let repository: jest.Mocked<BookingRepository>;
  let codeGenerator: jest.Mocked<BookingCodeGenerator>;
  let payosGateway: jest.Mocked<PayosGateway>;
  let cancellationPoliciesService: jest.Mocked<
    Pick<CancellationPoliciesService, 'getCompleteScheduleForBooking'>
  >;
  let roomsService: jest.Mocked<Pick<RoomsService, 'findEntitiesByIds'>>;
  let hotelsService: jest.Mocked<
    Pick<HotelsService, 'assertActive' | 'assertManagedBy'>
  >;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'createOnce'>>;
  let bookingSettingsRepository: jest.Mocked<BookingSettingsRepository>;
  let service: BookingsService;
  let config: ConfigService;
  let settings: Record<string, number | string>;
  let createBooking: jest.MockedFunction<BookingRepository['create']>;
  let withLockedById: jest.MockedFunction<BookingRepository['withLockedById']>;

  beforeEach(() => {
    createBooking = jest.fn();
    withLockedById = jest.fn();
    repository = {
      findUnavailableRoomIds: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      findByPaymentReference: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findPage: jest.fn(),
      findDueAutomaticRefundIds: jest.fn().mockResolvedValue([]),
      create: createBooking,
      save: jest.fn(),
      withLockedById,
    };
    codeGenerator = { generate: jest.fn() };
    payosGateway = {
      createPayment: jest.fn().mockResolvedValue({ linkId: 'payos-test-link-id', checkoutUrl: 'https://pay.payos.vn/web/payos-test-link-id' }),
      getPayment: jest.fn(),
      getRefund: jest.fn(),
      submitSettlementPayout: jest.fn(),
      getSettlementPayout: jest.fn(),
      isPayoutConfigured: jest.fn().mockReturnValue(true),
      refund: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
      verifyWebhook: jest.fn(),
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
    settings = {
      BOOKING_COMMISSION_RATE: 15,
      BOOKING_HOLD_MINUTES: 15,
      IDEMPOTENCY_KEY_TTL_HOURS: 24,
    };
    config = new ConfigService(settings);
    bookingSettingsRepository = { find: jest.fn().mockResolvedValue(null), save: jest.fn() };
    service = new BookingsService(
      repository,
      codeGenerator,
      payosGateway,
      cancellationPoliciesService as unknown as CancellationPoliciesService,
      roomsService as unknown as RoomsService,
      config,
      hotelsService as unknown as HotelsService,
      new BookingSettingsService(bookingSettingsRepository, config),
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
        appliedCommissionRate: 15,
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

  it('stores a configured zero commission on a new booking', async () => {
    bookingSettingsRepository.find.mockResolvedValue({ commissionRate: 0, updatedAt: new Date() });
    codeGenerator.generate.mockReturnValue('BK-20261104-ABCDEF1234');
    roomsService.findEntitiesByIds.mockResolvedValue([room()]);
    createBooking.mockResolvedValue({ booking: booking({ appliedCommissionRate: 0 }), replayed: false });

    await service.create(touristId, createInput(), idempotencyKey);

    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ appliedCommissionRate: 0 }),
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('returns the original booking when the same request is replayed', async () => {
    const saved = booking();
    repository.findByIdempotencyKey.mockResolvedValue(saved);

    await expect(
      service.create(touristId, createInput(), idempotencyKey),
    ).resolves.toEqual({ booking: saved, replayed: true });
    expect(roomsService.findEntitiesByIds).not.toHaveBeenCalled();
    expect(bookingSettingsRepository.find).not.toHaveBeenCalled();
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
      existing.guestEmail,
    );
  });


  it('creates a reusable payOS checkout for the 2,000 VND test booking', async () => {
    const current = booking({ amount: 2_000 });
    repository.findById.mockResolvedValue(current);
    repository.withLockedById.mockImplementation(async (_id, operation) => operation(current));
    const actor = { id: touristId, role: UserRole.TOURIST };
    const first = await service.createPayosPaymentForActor(bookingId, actor);
    expect(first.paymentUrl).toContain('pay.payos.vn');
    expect(current.paymentProvider).toBe(PaymentProvider.PAYOS);
    expect(Number.isSafeInteger(Number(current.paymentReference))).toBe(true);
    await expect(service.createPayosPaymentForActor(bookingId, actor)).resolves.toEqual(first);
    expect(current.paymentExpiresAt).toEqual(current.reservationExpiresAt);
    expect(payosGateway.createPayment).toHaveBeenCalledTimes(1);
  });

  it('rejects expired room holds before opening payOS', async () => {
    const current = booking({ reservationExpiresAt: new Date('2020-01-01T00:00:00Z') });
    repository.findById.mockResolvedValue(current);
    repository.withLockedById.mockImplementation(async (_id, operation) => operation(current));
    await expect(service.createPayosPaymentForActor(bookingId, { id: touristId, role: UserRole.TOURIST }))
      .rejects.toBeInstanceOf(BookingReservationExpiredException);
    expect(payosGateway.createPayment).not.toHaveBeenCalled();
  });

  it.each([false, true])('matches a signed payment once and handles an expired hold (%s)', async expired => {
    const orderCode = 12345678901234;
    const linkId = 'payos-test-link-id';
    const current = booking({
      paymentProvider: PaymentProvider.PAYOS,
      paymentReference: String(orderCode),
      paymentLinkId: linkId,
      paymentStatus: PaymentStatus.PAYMENT_PENDING,
      paymentCreatedAt: new Date(Date.now() - 60_000),
      ...(expired ? { reservationExpiresAt: new Date(Date.now() - 10_000) } : {}),
    });
    repository.findByPaymentReference.mockResolvedValue(current);
    repository.withLockedById.mockImplementation(async (_id, operation) => operation(current));
    const payment = {
      orderCode, linkId, status: 'PAID', amount: current.amount, amountPaid: current.amount,
      paid: { reference: 'TRANSFER1', at: new Date(), destination: { bank: '970422', account: '123456789' } },
    };
    payosGateway.verifyWebhook.mockResolvedValueOnce(null).mockResolvedValue({ orderCode, linkId });
    payosGateway.getPayment.mockResolvedValueOnce({ ...payment, amount: current.amount + 1 }).mockResolvedValue(payment);
    await expect(service.handlePayosWebhook({})).rejects.toThrow('Chữ ký');
    await service.handlePayosWebhook({});
    expect(current.paymentStatus).toBe(PaymentStatus.PAYMENT_PENDING);
    await service.handlePayosWebhook({});
    await service.handlePayosWebhook({});
    expect(payosGateway.getPayment).toHaveBeenCalledTimes(2);
    expect(current.paymentTransactionId).toBe('PAYOS:TRANSFER1');
    expect(current.refundDestination).toEqual(payment.paid.destination);
    expect(current.bookingStatus).toBe(expired ? BookingStatus.CANCELLED : BookingStatus.CONFIRMED);
    expect(current.refundStatus).toBe(expired ? RefundStatus.PENDING : RefundStatus.NONE);
  });

  it.each([PaymentStatus.PAYMENT_PENDING, PaymentStatus.FAILED])('releases a %s booking once when payOS confirms cancellation without funds', async paymentStatus => {
    const orderCode = 12345678901234;
    const linkId = 'payos-test-link-id';
    const current = booking({
      paymentProvider: PaymentProvider.PAYOS, paymentReference: String(orderCode), paymentLinkId: linkId,
      paymentStatus,
    });
    repository.findById.mockResolvedValue(current);
    repository.withLockedById.mockImplementation(async (_id, operation) => operation(current));
    payosGateway.getPayment.mockResolvedValue({ orderCode, linkId, amount: current.amount, amountPaid: 0, status: 'CANCELLED', paid: null });
    const actor = { id: touristId, role: UserRole.TOURIST };
    await expect(service.refreshPayosPaymentForActor(bookingId, actor)).resolves.toMatchObject({
      bookingStatus: BookingStatus.CANCELLED,
      paymentStatus: PaymentStatus.FAILED,
      cancelledAt: expect.any(Date),
      cancellationFeeAmount: 0,
      refundAmount: null,
      refundStatus: RefundStatus.NONE,
    });
    await expect(service.refreshPayosPaymentForActor(bookingId, actor)).resolves.toBe(current);
    expect(payosGateway.getPayment).toHaveBeenCalledTimes(1);
    expect(notificationsService.createOnce).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['2026-11-27T16:54:00.000Z', PaymentStatus.PAID, BookingStatus.CONFIRMED],
    ['2026-11-27T16:53:00.000Z', PaymentStatus.PAYMENT_PENDING, BookingStatus.PENDING],
    ['2026-11-27T16:54:20.000Z', PaymentStatus.PAYMENT_PENDING, BookingStatus.PENDING],
  ] as const)('reconciles payOS with the precision of the transfer time %s', async (transferTime, paymentStatus, bookingStatus) => {
    const orderCode = 12345678901234;
    const linkId = 'payos-test-link-id';
    const current = booking({
      paymentProvider: PaymentProvider.PAYOS, paymentReference: String(orderCode), paymentLinkId: linkId,
      paymentStatus: PaymentStatus.PAYMENT_PENDING, paymentCreatedAt: new Date('2026-11-27T16:54:34.493Z'),
    });
    repository.findById.mockResolvedValue(current);
    withLockedById.mockImplementation(async (_id, operation) => operation(current));
    payosGateway.getPayment.mockResolvedValue({
      orderCode, linkId, amount: current.amount, amountPaid: current.amount, status: 'PAID',
      paid: { at: new Date(transferTime), reference: 'MINUTE-TRANSFER', destination: null },
    });

    await expect(service.refreshPayosPaymentForActor(bookingId, { id: touristId, role: UserRole.TOURIST }))
      .resolves.toMatchObject({ paymentStatus, bookingStatus });
    if (paymentStatus === PaymentStatus.PAID) expect(current.paidAt?.toISOString()).toBe(transferTime);
  });

  it.each([
    ['PENDING', 0, PaymentStatus.PAYMENT_PENDING],
    ['FAILED', 0, PaymentStatus.FAILED],
    ['CANCELLED', 2_000, PaymentStatus.PAYMENT_PENDING],
  ] as const)('preserves the hold unless payOS confirms unpaid cancellation (%s, %s)', async (status, amountPaid, paymentStatus) => {
    const orderCode = 12345678901234;
    const linkId = 'payos-test-link-id';
    const current = booking({
      paymentProvider: PaymentProvider.PAYOS, paymentReference: String(orderCode), paymentLinkId: linkId,
      paymentStatus: PaymentStatus.PAYMENT_PENDING,
    });
    repository.findById.mockResolvedValue(current);
    repository.withLockedById.mockImplementation(async (_id, operation) => operation(current));
    payosGateway.getPayment.mockResolvedValue({ orderCode, linkId, amount: current.amount, amountPaid, status, paid: null });
    await expect(service.refreshPayosPaymentForActor(bookingId, { id: touristId, role: UserRole.TOURIST }))
      .resolves.toMatchObject({ bookingStatus: BookingStatus.PENDING, paymentStatus, cancelledAt: null });
    expect(notificationsService.createOnce).not.toHaveBeenCalled();
  });

  it.each([null, { bank: '970422', account: '123456789' }])('records a verified late payment for refund with destination %j', async (destination) => {
    config.set('PAYOS_AUTO_REFUNDS_ENABLED', true);
    const orderCode = 12345678901234;
    const linkId = 'payos-test-link-id';
    const current = booking({
      bookingStatus: BookingStatus.CANCELLED, cancelledAt: new Date(),
      paymentProvider: PaymentProvider.PAYOS, paymentReference: String(orderCode), paymentLinkId: linkId,
      paymentStatus: PaymentStatus.FAILED, paymentCreatedAt: new Date(Date.now() - 60_000),
    });
    repository.findByPaymentReference.mockResolvedValue(current);
    repository.withLockedById.mockImplementation(async (_id, operation) => operation(current));
    payosGateway.verifyWebhook.mockResolvedValue({ orderCode, linkId });
    payosGateway.getPayment.mockResolvedValue({
      orderCode, linkId, amount: current.amount, amountPaid: current.amount, status: 'PAID',
      paid: { reference: 'LATE-TRANSFER', at: new Date(), destination },
    });
    await service.handlePayosWebhook({});
    expect(current).toMatchObject({
      bookingStatus: BookingStatus.CANCELLED, paymentStatus: PaymentStatus.PAID,
      refundStatus: RefundStatus.PENDING, refundAmount: current.amount,
    });
    expect(Boolean(current.refundRequestId)).toBe(Boolean(destination));
    expect(payosGateway.refund.mock.calls).toHaveLength(0);
  });

  it('traces an uncertain refund by its original request and never resubmits it', async () => {
    const current = booking({
      bookingStatus: BookingStatus.CANCELLED, paymentProvider: PaymentProvider.PAYOS, paymentStatus: PaymentStatus.PAID,
      refundAmount: 5_000, refundStatus: RefundStatus.PENDING,
      refundDestination: { bank: '970422', account: '123456789' },
    });
    repository.findById.mockResolvedValue(current);
    repository.withLockedById.mockImplementation(async (_id, operation) => operation(current));
    payosGateway.refund.mockRejectedValue(new Error('Timeout'));
    const admin = { id: touristId, role: UserRole.ADMIN };
    const request = { refundAmount: 5_000, refundReason: 'Test' };
    await expect(service.refund(bookingId, request, admin)).resolves.toMatchObject({ refundStatus: RefundStatus.PROCESSING });
    await expect(service.refund(bookingId, request, admin)).rejects.toThrow('already been initialized');
    payosGateway.getRefund.mockResolvedValue({ status: 'succeeded', reference: 'REFUND1' });
    await expect(service.refreshPayosRefund(bookingId, admin)).resolves.toMatchObject({
      refundStatus: RefundStatus.REFUNDED, refundTransactionId: 'PAYOS:REFUND1',
    });
    expect(payosGateway.refund).toHaveBeenCalledTimes(1);
    expect(payosGateway.getRefund).toHaveBeenCalledWith(payosGateway.refund.mock.calls[0][0]);
  });

  it('recovers a missing refund destination only from the original verified transfer', async () => {
    config.set('PAYOS_AUTO_REFUNDS_ENABLED', true);
    const orderCode = 12345678901234;
    const linkId = 'payos-test-link-id';
    const destination = { bank: '970407', account: '1234567890' };
    const current = booking({
      bookingStatus: BookingStatus.CANCELLED, paymentProvider: PaymentProvider.PAYOS,
      paymentStatus: PaymentStatus.PAID, paymentReference: String(orderCode), paymentLinkId: linkId,
      paymentTransactionId: 'PAYOS:ORIGINAL', refundStatus: RefundStatus.PENDING, refundAmount: 2000, refundAttempt: 1,
    });
    const payment = {
      orderCode, linkId, status: 'PAID', amount: current.amount, amountPaid: current.amount,
      paid: { reference: 'ORIGINAL', at: new Date(), destination },
    };
    const actor = { role: UserRole.TOURIST, id: touristId };
    repository.findById.mockResolvedValue(current);
    withLockedById.mockImplementation(async (_id, operation) => operation(current));
    payosGateway.getPayment.mockResolvedValueOnce({ ...payment, paid: { ...payment.paid, reference: 'WRONG' } })
      .mockResolvedValue(payment);

    await service.refreshPayosPaymentForActor(bookingId, actor);
    expect(current.refundDestination).toBeNull();
    expect(current.refundRequestId).toBeNull();

    await service.refreshPayosPaymentForActor(bookingId, actor);
    const requestId = current.refundRequestId;
    expect(current).toMatchObject({
      bookingStatus: BookingStatus.CANCELLED, refundStatus: RefundStatus.PENDING, refundAmount: 2000,
      refundDestination: destination, refundRequestId: expect.stringMatching(/^[a-f0-9]{32}$/),
    });
    await service.refreshPayosPaymentForActor(bookingId, actor);
    expect(current.refundRequestId).toBe(requestId);
    expect(payosGateway.getPayment.mock.calls).toHaveLength(2);
    expect(payosGateway.refund.mock.calls).toHaveLength(0);
  });

  it('cancels a paid tiered booking and persists the refund before dispatching it', async () => {
    config.set('PAYOS_AUTO_REFUNDS_ENABLED', true);
    const current = booking({
      bookingStatus: BookingStatus.CONFIRMED, paymentProvider: PaymentProvider.PAYOS,
      paymentStatus: PaymentStatus.PAID, checkInDate: '2099-12-01',
      createdAt: new Date(Date.now() - 1_000),
      refundDestination: { bank: '970422', account: '123456789' },
      cancellationPolicySnapshot: {
        version: cancellationPolicyVersion, basis: 'HOURS_AFTER_BOOKING',
        inclusiveHourLimits: true, timezone: 'Asia/Ho_Chi_Minh', checkInTime: '14:00',
        rules: [{
          id: policyId + ':0', name: 'Tiered',
          minHoursAfterBooking: 0, maxHoursAfterBooking: 24,
          cancellationAllowed: true, cancellationFeeRate: 20, description: null,
        }],
      },
    });
    repository.findById.mockResolvedValue(current);
    withLockedById.mockImplementation(async (_id, operation) => operation(current));
    repository.findDueAutomaticRefundIds.mockResolvedValue([bookingId]);
    payosGateway.refund.mockResolvedValue({ status: 'pending' });

    await expect(service.cancelForActor(bookingId, { id: touristId, role: UserRole.TOURIST })).resolves.toMatchObject({
      bookingStatus: BookingStatus.CANCELLED,
      cancellationPolicyId: null,
      cancellationFeeAmount: 200_000,
      refundAmount: 800_000,
      refundStatus: RefundStatus.PENDING,
      refundRequestId: expect.stringMatching(/^[a-f0-9]{32}$/),
    });
    expect(payosGateway.refund.mock.calls).toHaveLength(0);

    const requestId = current.refundRequestId;
    await service.processAutomaticRefunds();
    expect(payosGateway.refund.mock.calls).toEqual([[{ requestId, amount: 800_000, destination: current.refundDestination }]]);
    expect(current.refundStatus).toBe(RefundStatus.PROCESSING);

    current.updatedAt = new Date(0);
    payosGateway.getRefund.mockResolvedValue({ status: 'succeeded', reference: 'AUTO-REFUND-1' });
    await service.processAutomaticRefunds();
    expect(payosGateway.getRefund.mock.calls).toEqual(payosGateway.refund.mock.calls);
    expect(payosGateway.refund.mock.calls).toHaveLength(1);
    expect(current).toMatchObject({ refundStatus: RefundStatus.REFUNDED, refundTransactionId: 'PAYOS:AUTO-REFUND-1' });
  });

  it('does not send new automatic payouts for unqueued refunds or repeat ambiguous ones', async () => {
    config.set('PAYOS_AUTO_REFUNDS_ENABLED', true);
    const current = booking({
      bookingStatus: BookingStatus.CANCELLED, paymentProvider: PaymentProvider.PAYOS,
      paymentStatus: PaymentStatus.PAID, refundStatus: RefundStatus.PENDING, refundAmount: 5000,
      refundDestination: { bank: '970422', account: '123456789' },
    });
    withLockedById.mockImplementation(async (_id, operation) => operation(current));
    repository.findDueAutomaticRefundIds.mockResolvedValue([bookingId]);
    await service.processAutomaticRefunds();
    expect(payosGateway.refund.mock.calls).toHaveLength(0);

    current.refundRequestId = 'f'.repeat(32);
    payosGateway.refund.mockRejectedValue(new Error('Timeout'));
    await service.processAutomaticRefunds();
    expect(current.refundStatus).toBe(RefundStatus.PROCESSING);

    current.updatedAt = new Date(0);
    payosGateway.getRefund.mockResolvedValue({ status: 'pending' });
    await service.processAutomaticRefunds();
    expect(payosGateway.refund.mock.calls).toHaveLength(1);
    expect(payosGateway.getRefund.mock.calls).toEqual(payosGateway.refund.mock.calls);
    expect(current.refundStatus).toBe(RefundStatus.PROCESSING);
  });

  it('records a pending historical refund once and accepts an exact retry without calling payOS', async () => {
    const current = booking({
      bookingStatus: BookingStatus.CANCELLED,
      paymentStatus: PaymentStatus.PAID,
      paymentProvider: PaymentProvider.LEGACY_LIVE,
      refundAmount: 2_000,
      refundStatus: RefundStatus.PENDING,
      refundReason: 'Đã hủy booking',
      refundAttempt: 1,
    });
    repository.withLockedById.mockImplementation(async (_id, operation) => operation(current));
    const input = { refundAmount: 2_000, refundTransactionId: 'FT-MB-2000' };
    const admin = { id: '77777777-7777-4777-8777-777777777777', role: UserRole.ADMIN };
    await expect(service.confirmManualRefund(bookingId, input, {
      id: touristId, role: UserRole.TOURIST,
    })).rejects.toBeInstanceOf(AuthorizationDeniedException);
    expect(repository.withLockedById).not.toHaveBeenCalled();
    await expect(service.confirmManualRefund(bookingId, { ...input, refundAmount: 1_000 }, admin))
      .rejects.toThrow('must match');
    expect(current.refundStatus).toBe(RefundStatus.PENDING);

    const result = await service.confirmManualRefund(bookingId, input, admin);
    expect(result).toMatchObject({
      refundStatus: RefundStatus.REFUNDED,
      refundAmount: 2_000,
      refundHandledBy: admin.id,
      refundTransactionId: input.refundTransactionId,
      refundedAt: expect.any(Date),
    });
    const refundedAt = result.refundedAt;
    await expect(service.confirmManualRefund(bookingId, input, admin)).resolves.toMatchObject({ refundedAt });
    await expect(service.confirmManualRefund(bookingId, { ...input, refundTransactionId: 'FT-OTHER' }, admin))
      .rejects.toThrow('already complete');
    expect(payosGateway.refund).not.toHaveBeenCalled();
    expect(notificationsService.createOnce).toHaveBeenCalledWith(expect.objectContaining({
      type: NotificationType.REFUND_SUCCEEDED,
      eventKey: `booking:${bookingId}:refund:1:succeeded`,
    }), current.guestEmail);
  });

  it.each([
    { paymentProvider: PaymentProvider.PAYOS },
    { refundStatus: RefundStatus.NONE },
    { settlementStatus: SettlementStatus.PROCESSING },
  ])('does not manually complete an ineligible refund (%j)', async (overrides) => {
    const current = booking({
      paymentStatus: PaymentStatus.PAID,
      paymentProvider: PaymentProvider.LEGACY_LIVE,
      refundStatus: RefundStatus.PENDING,
      refundAmount: 2_000,
      refundReason: 'Đã hủy booking',
      ...overrides,
    });
    repository.withLockedById.mockImplementation(async (_id, operation) => operation(current));
    await expect(service.confirmManualRefund(
      bookingId,
      { refundAmount: 2_000, refundTransactionId: 'FT-MB-2000' },
      { id: touristId, role: UserRole.ADMIN },
    )).rejects.toThrow('in its current state');
  });

});
