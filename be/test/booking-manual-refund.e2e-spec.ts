import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import type { AuthenticatedRequest } from '../src/modules/auth/interfaces/authenticated-request.interface';
import { RolesGuard } from '../src/modules/authorization/guards/roles.guard';
import { BookingsController } from '../src/modules/bookings/controllers/bookings.controller';
import { BookingEntity, BookingStatus, PaymentProvider, PaymentStatus, RefundStatus } from '../src/modules/bookings/entities/booking.entity';
import { BookingsService } from '../src/modules/bookings/services/bookings.service';
import { UserRole } from '../src/modules/users/entities/user.entity';

const bookingId = '11111111-1111-4111-8111-111111111111';
const actorId = '77777777-7777-4777-8777-777777777777';
const path = `/api/v1/bookings/${bookingId}/refund/manual-completion`;

describe('Historical refund API', () => {
  let app: INestApplication<App>;
  const confirmManualRefund = jest.fn();
  const valid = { refundAmount: 2_000, refundTransactionId: 'FT-MB-2000' };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [RolesGuard, { provide: BookingsService, useValue: { confirmManualRefund } }],
    }).compile();
    app = module.createNestApplication();
    app.use((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      const role = req.headers['x-test-role'] === 'admin' ? UserRole.ADMIN : UserRole.TOURIST;
      req.authUser = { id: actorId, role } as AuthenticatedRequest['authUser'];
      next();
    });
    configureHttpApplication(app);
    app.useGlobalGuards(app.get(RolesGuard));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  beforeEach(() => confirmManualRefund.mockReset());
  afterAll(async () => { await app.close(); });

  it('limits confirmation to administrators', async () => {
    await request(app.getHttpServer()).put(path).send(valid).expect(403);
    expect(confirmManualRefund).not.toHaveBeenCalled();
  });

  it('requires a non-blank bank reference', async () => {
    await request(app.getHttpServer()).put(path).set('x-test-role', 'admin')
      .send({ ...valid, refundTransactionId: '   ' }).expect(400);
    expect(confirmManualRefund).not.toHaveBeenCalled();
  });

  it('uses the session actor and returns the recorded refund', async () => {
    const date = new Date('2026-11-27T03:00:00Z');
    confirmManualRefund.mockResolvedValue(Object.assign(new BookingEntity(), {
      id: bookingId,
      createdAt: date,
      updatedAt: date,
      reservationExpiresAt: date,
      bookingStatus: BookingStatus.CANCELLED,
      paymentStatus: PaymentStatus.PAID,
      refundStatus: RefundStatus.REFUNDED,
      paymentProvider: PaymentProvider.LEGACY_LIVE,
      refundAmount: valid.refundAmount,
      refundTransactionId: valid.refundTransactionId,
      refundedAt: date,
    }));
    const response = await request(app.getHttpServer()).put(path).set('x-test-role', 'admin')
      .send({ ...valid, refundTransactionId: ' FT-MB-2000 ' }).expect(200);
    expect(confirmManualRefund).toHaveBeenCalledWith(bookingId, valid, {
      id: actorId, role: UserRole.ADMIN,
    });
    expect(response.body).toMatchObject({
      manualRefund: true, refundStatus: 'REFUNDED', refundedAt: date.toISOString(), ...valid,
    });
  });
});
