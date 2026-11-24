import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { BookingsController } from '../src/modules/bookings/controllers/bookings.controller';
import { VnpayCallbacksController } from '../src/modules/bookings/controllers/vnpay-callbacks.controller';
import {
  BookingEntity,
  BookingStatus,
  PaymentStatus,
  RefundStatus,
  SettlementStatus,
} from '../src/modules/bookings/entities/booking.entity';
import {
  BookingNotFoundException,
  IdempotencyKeyReusedException,
} from '../src/modules/bookings/exceptions/booking.exceptions';
import { BookingsService } from '../src/modules/bookings/services/bookings.service';

const bookingId = '11111111-1111-4111-8111-111111111111';
const hotelId = '22222222-2222-4222-8222-222222222222';
const touristId = '33333333-3333-4333-8333-333333333333';
const roomId = '44444444-4444-4444-8444-444444444444';
const idempotencyKey = '55555555-5555-4555-8555-555555555555';

const entity = (overrides: Partial<BookingEntity> = {}): BookingEntity =>
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
    childCount: 1,
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
    cancellationWindowSnapshot: null,
    cancellationFeeRateSnapshot: null,
    cancellationDescriptionSnapshot: null,
    refundAmount: null,
    refundReason: null,
    refundStatus: RefundStatus.NONE,
    refundedAt: null,
    refundTransactionId: null,
    roomItems: [],
    ...overrides,
  });

describe('Bookings API (e2e)', () => {
  let app: INestApplication<App>;
  const service = {
    create: jest.fn(),
    findPage: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    createVnpayPayment: jest.fn(),
    handleVnpayIpn: jest.fn(),
    getVnpayReturn: jest.fn(),
    settle: jest.fn(),
    refund: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController, VnpayCallbacksController],
      providers: [{ provide: BookingsService, useValue: service }],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a booking and returns its location', async () => {
    service.create.mockResolvedValue({ booking: entity(), replayed: false });

    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        touristId,
        roomIds: [roomId],
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-03',
        adultCount: 2,
        childCount: 1,
        guestName: ' Nguyen Van A ',
        guestEmail: ' Guest@Example.com ',
        guestPhone: '0912345678',
      })
      .expect(201)
      .expect('Location', `/api/v1/bookings/${bookingId}`)
      .expect('Idempotency-Replayed', 'false')
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: bookingId,
          hotelId,
          touristId,
          bookingCode: 'BK-20261104-ABCDEF1234',
          bookingStatus: BookingStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          settlementStatus: SettlementStatus.PENDING,
          refundStatus: RefundStatus.NONE,
        });
      });

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        guestName: 'Nguyen Van A',
        guestEmail: 'Guest@Example.com',
        roomIds: [roomId],
      }),
      idempotencyKey,
    );
  });

  it('marks a replayed create response', async () => {
    service.create.mockResolvedValue({ booking: entity(), replayed: true });

    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        touristId,
        roomIds: [roomId],
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-03',
        adultCount: 2,
        childCount: 0,
        guestName: 'Guest',
        guestEmail: 'guest@example.com',
        guestPhone: '0912345678',
      })
      .expect(201)
      .expect('Idempotency-Replayed', 'true');
  });

  it('requires a UUID v4 Idempotency-Key', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Idempotency-Key', 'not-a-uuid')
      .send({})
      .expect(400);
  });

  it('rejects reuse of a key with a different request body', async () => {
    service.create.mockRejectedValue(new IdempotencyKeyReusedException());

    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        touristId,
        roomIds: [roomId],
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-03',
        adultCount: 2,
        childCount: 0,
        guestName: 'Guest',
        guestEmail: 'guest@example.com',
        guestPhone: '0912345678',
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('IDEMPOTENCY_KEY_REUSED');
      });
  });

  it('rejects system-managed payment fields in the create request', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        touristId,
        roomIds: [roomId],
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-03',
        adultCount: 1,
        childCount: 0,
        guestName: 'Guest',
        guestEmail: 'guest@example.com',
        guestPhone: '0912345678',
        totalAmount: 500_000,
        paymentStatus: PaymentStatus.PAID,
      })
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_FAILED');
      });
  });

  it('creates a VNPAY Sandbox payment URL without choosing a method', async () => {
    const pendingBooking = entity({
      paymentMethod: null,
      paymentStatus: PaymentStatus.PAYMENT_PENDING,
      paymentCreatedAt: new Date('2026-11-04T01:00:00.000Z'),
      paymentExpiresAt: new Date('2026-11-04T01:15:00.000Z'),
    });
    service.createVnpayPayment.mockResolvedValue({
      booking: pendingBooking,
      paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?signed=1',
    });

    await request(app.getHttpServer())
      .put(`/api/v1/bookings/${bookingId}/payment/vnpay`)
      .send({ locale: 'vn' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.bookingId).toBe(bookingId);
        expect(body.paymentMethod).toBeNull();
        expect(body.paymentStatus).toBe(PaymentStatus.PAYMENT_PENDING);
        expect(body.paymentUrl).toContain('sandbox.vnpayment.vn');
      });

    expect(service.createVnpayPayment).toHaveBeenCalledWith(
      bookingId,
      expect.objectContaining({ locale: 'vn' }),
      expect.any(String),
    );
  });

  it('does not expose the old QR-only payment endpoint', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/bookings/${bookingId}/payment/qr`)
      .send({ locale: 'vn' })
      .expect(404);
  });

  it('exposes the VNPAY IPN response contract', async () => {
    service.handleVnpayIpn.mockResolvedValue({
      RspCode: '00',
      Message: 'Confirm Success',
    });

    await request(app.getHttpServer())
      .get('/api/v1/payments/vnpay/ipn?vnp_TxnRef=ABC')
      .expect(200)
      .expect({ RspCode: '00', Message: 'Confirm Success' });
  });

  it('does not expose manual payment completion after VNPAY integration', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/bookings/${bookingId}/payment/complete`)
      .send({ paymentTransactionId: 'FORGED' })
      .expect(404);
  });

  it('maps a missing booking to problem details', async () => {
    service.findById.mockRejectedValue(new BookingNotFoundException(bookingId));

    await request(app.getHttpServer())
      .get(`/api/v1/bookings/${bookingId}`)
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('BOOKING_NOT_FOUND');
      });
  });

  it('does not expose a hard-delete booking endpoint', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/bookings/${bookingId}`)
      .expect(404);
  });
});
