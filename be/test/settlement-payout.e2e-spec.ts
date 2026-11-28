import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import type { AuthenticatedRequest } from '../src/modules/auth/interfaces/authenticated-request.interface';
import { RolesGuard } from '../src/modules/authorization/guards/roles.guard';
import { SettlementsController } from '../src/modules/bookings/controllers/settlements.controller';
import { SettlementsService } from '../src/modules/bookings/services/settlements.service';
import { UserRole } from '../src/modules/users/entities/user.entity';

const batchId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';
const adminId = '33333333-3333-4333-8333-333333333333';
const path = `/api/v1/settlements/${batchId}/payout`;

describe('Administrator payout API', () => {
  let app: INestApplication<App>;
  const requestPayout = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SettlementsController],
      providers: [RolesGuard, { provide: SettlementsService, useValue: { requestPayout } }],
    }).compile();
    app = module.createNestApplication();
    app.use((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      const role = req.headers['x-test-role'] === 'admin' ? UserRole.ADMIN : UserRole.HOTEL_OWNER;
      req.authUser = { id: role === UserRole.ADMIN ? adminId : ownerId, role } as AuthenticatedRequest['authUser'];
      next();
    });
    configureHttpApplication(app);
    app.useGlobalGuards(app.get(RolesGuard));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  beforeEach(() => requestPayout.mockReset());
  afterAll(async () => { await app.close(); });

  it('denies hotel owners and removes their former payout endpoint', async () => {
    await request(app.getHttpServer()).post(path).send({ revision: 2 }).expect(403);
    await request(app.getHttpServer()).post(`/api/v1/settlements/mine/${batchId}/payout`).send({ revision: 2 }).expect(404);
    expect(requestPayout).not.toHaveBeenCalled();
  });

  it('accepts a batch revision without accepting replacement payout details', async () => {
    await request(app.getHttpServer()).post(path).set('x-test-role', 'admin').send({ revision: 2, amount: 100_000 }).expect(400);
    expect(requestPayout).not.toHaveBeenCalled();

    requestPayout.mockResolvedValue({
      id: batchId,
      status: 'PROCESSING',
      transferMode: 'PAYOS',
      revision: 3,
      items: [],
      events: [],
      payoutRequestId: 'private-payout-reference',
    });
    const response = await request(app.getHttpServer()).post(path).set('x-test-role', 'admin').send({ revision: 2 }).expect(200);
    expect(requestPayout).toHaveBeenCalledWith(batchId, 2, { id: adminId, role: UserRole.ADMIN });
    expect(response.body).toMatchObject({ status: 'PROCESSING', transferMode: 'PAYOS', revision: 3 });
    expect(response.body).not.toHaveProperty('payoutRequestId');
  });
});
