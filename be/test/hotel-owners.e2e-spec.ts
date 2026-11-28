import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { HotelOwnersController } from '../src/modules/hotel-owners/controllers/hotel-owners.controller';
import { HotelOwnerEntity } from '../src/modules/users/entities/hotel-owner.entity';
import { HotelOwnerNotFoundException } from '../src/modules/hotel-owners/exceptions/hotel-owner.exceptions';
import { HotelOwnersService } from '../src/modules/hotel-owners/services/hotel-owners.service';
import { selectableBanks } from '../src/modules/hotel-owners/catalog/vietqr-banks';
import type { AuthenticatedRequest } from '../src/modules/auth/interfaces/authenticated-request.interface';
import { UserRole } from '../src/modules/users/entities/user.entity';
import type { NextFunction, Response } from 'express';

const userId = '11111111-1111-4111-8111-111111111111';
const entity = Object.assign(new HotelOwnerEntity(), {
  userId,
  bankName: 'Example Bank',
  bankAccountNumber: '123456789',
  bankAccountHolder: 'NGUYEN VAN A',
});

describe('Hotel Owners API (e2e)', () => {
  let app: INestApplication<App>;
  const service = {
    create: jest.fn(),
    listBanks: jest.fn().mockReturnValue(selectableBanks),
    findPage: jest.fn(),
    findByUserIdForActor: jest.fn(),
    updateForActor: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HotelOwnersController],
      providers: [{ provide: HotelOwnersService, useValue: service }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(
      (
        currentRequest: AuthenticatedRequest,
        _response: Response,
        next: NextFunction,
      ) => {
        currentRequest.authUser = {
          id: userId,
          role: UserRole.HOTEL_OWNER,
        } as never;
        next();
      },
    );
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a hotel owner profile and returns its location', async () => {
    service.create.mockResolvedValue(entity);

    await request(app.getHttpServer())
      .post('/api/v1/hotel-owners')
      .send({
        userId,
        bankName: ' Example Bank ',
        bankAccountNumber: '123456789',
        bankAccountHolder: 'NGUYEN VAN A',
      })
      .expect(201)
      .expect('Location', `/api/v1/hotel-owners/${userId}`)
      .expect(({ body }) => {
        expect(body).toEqual({
          userId,
          bankName: 'Example Bank',
          bankBin: null,
          bankAccountNumber: '123456789',
          bankAccountHolder: 'NGUYEN VAN A',
        });
      });
  });

  it('rejects unknown writable fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/hotel-owners')
      .send({ userId, role: 'ADMIN' })
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_FAILED');
      });
  });

  it('allows a nullable bank field to be cleared', async () => {
    service.updateForActor.mockResolvedValue(
      Object.assign(new HotelOwnerEntity(), entity, {
        bankAccountNumber: null,
      }),
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/hotel-owners/${userId}`)
      .send({ bankAccountNumber: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body.bankAccountNumber).toBeNull();
      });
  });

  it('serves the bank catalog instead of treating banks as an owner ID', async () => {
    await request(app.getHttpServer()).get('/api/v1/hotel-owners/banks').expect(200).expect(({ body }) => {
      expect(body).toContainEqual(expect.objectContaining({ code: 'TCB', bin: '970407' }));
    });
    expect(service.findByUserIdForActor).not.toHaveBeenCalled();
  });

  it('accepts a six-digit BIN as a bank selection', async () => {
    service.updateForActor.mockResolvedValue(Object.assign(new HotelOwnerEntity(), entity, {
      bankBin: '970436', bankName: 'Vietcombank',
    }));
    await request(app.getHttpServer()).patch(`/api/v1/hotel-owners/${userId}`).send({ bankBin: 'bad' }).expect(400);
    await request(app.getHttpServer()).patch(`/api/v1/hotel-owners/${userId}`).send({
      bankBin: '970436', bankAccountNumber: '0123456789', bankAccountHolder: 'NGUYEN VAN A',
    }).expect(200).expect(({ body }) => { expect(body.bankBin).toBe('970436'); });
  });

  it('maps a missing hotel owner profile to problem details', async () => {
    service.findByUserIdForActor.mockRejectedValue(
      new HotelOwnerNotFoundException(userId),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/hotel-owners/${userId}`)
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('HOTEL_OWNER_NOT_FOUND');
      });
  });

  it('deletes a hotel owner profile without returning a body', async () => {
    service.delete.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete(`/api/v1/hotel-owners/${userId}`)
      .expect(204);
  });
});
