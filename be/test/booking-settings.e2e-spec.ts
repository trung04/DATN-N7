import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import type { AuthenticatedRequest } from '../src/modules/auth/interfaces/authenticated-request.interface';
import { RolesGuard } from '../src/modules/authorization/guards/roles.guard';
import { AdminBookingSettingsController } from '../src/modules/bookings/controllers/admin-booking-settings.controller';
import { BOOKING_SETTINGS_REPOSITORY } from '../src/modules/bookings/interfaces/booking-settings.repository.interface';
import type { BookingSettings } from '../src/modules/bookings/interfaces/booking-settings.repository.interface';
import { BookingSettingsService } from '../src/modules/bookings/services/booking-settings.service';
import { UserRole } from '../src/modules/users/entities/user.entity';

const path = '/api/v1/admin/settings/bookings';
const adminId = '11111111-1111-4111-8111-111111111111';
const updatedAt = new Date('2026-11-28T02:00:00Z');

describe('Admin booking settings API', () => {
  let app: INestApplication<App>;
  let stored: BookingSettings | null = null;
  const save = jest.fn(async (commissionRate: number, _adminId: string) => {
    stored = { commissionRate, updatedAt };
    return stored;
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminBookingSettingsController],
      providers: [
        BookingSettingsService,
        RolesGuard,
        { provide: ConfigService, useValue: new ConfigService({ BOOKING_COMMISSION_RATE: 15 }) },
        { provide: BOOKING_SETTINGS_REPOSITORY, useValue: { find: async () => stored, save } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      const role = req.headers['x-test-role'] === 'admin' ? UserRole.ADMIN : UserRole.HOTEL_OWNER;
      req.authUser = { id: adminId, role } as AuthenticatedRequest['authUser'];
      next();
    });
    configureHttpApplication(app);
    app.useGlobalGuards(app.get(RolesGuard));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  beforeEach(() => {
    stored = null;
    save.mockClear();
  });

  afterAll(async () => { await app.close(); });

  it('restricts access to administrators', async () => {
    await request(app.getHttpServer()).get(path).expect(403);
    await request(app.getHttpServer()).put(path).send({ commissionRate: 0 }).expect(403);
    expect(save).not.toHaveBeenCalled();
  });

  it('uses the environment default until an administrator saves a rate, including zero', async () => {
    await request(app.getHttpServer()).get(path).set('x-test-role', 'admin')
      .expect(200, { commissionRate: 15, updatedAt: null });
    for (const commissionRate of [12.75, 0, 100]) {
      await request(app.getHttpServer()).put(path).set('x-test-role', 'admin').send({ commissionRate })
        .expect(200, { commissionRate, updatedAt: updatedAt.toISOString() });
      await request(app.getHttpServer()).get(path).set('x-test-role', 'admin')
        .expect(200, { commissionRate, updatedAt: updatedAt.toISOString() });
      expect(save).toHaveBeenLastCalledWith(commissionRate, adminId);
    }
  });

  it.each([
    {}, { commissionRate: -1 }, { commissionRate: 101 }, { commissionRate: 0.001 },
    { commissionRate: 1e-7 }, { commissionRate: '15' }, { commissionRate: null },
    { commissionRate: 0, updatedBy: adminId },
  ])('rejects invalid settings %j', async body => {
    await request(app.getHttpServer()).put(path).set('x-test-role', 'admin').send(body).expect(400);
    expect(save).not.toHaveBeenCalled();
  });
});
