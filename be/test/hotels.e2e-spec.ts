import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { AdminHotelsController } from '../src/modules/hotels/controllers/admin-hotels.controller';
import { HotelsController } from '../src/modules/hotels/controllers/hotels.controller';
import { HotelReviewCommand } from '../src/modules/hotels/dtos/requests/review-hotel.request';
import { HotelDocumentType } from '../src/modules/hotels/entities/hotel-document.entity';
import {
  HotelEntity,
  HotelStatus,
} from '../src/modules/hotels/entities/hotel.entity';
import { HotelsService } from '../src/modules/hotels/services/hotels.service';
import type { AuthenticatedRequest } from '../src/modules/auth/interfaces/authenticated-request.interface';
import { UserRole } from '../src/modules/users/entities/user.entity';
import type { NextFunction, Response } from 'express';

const hotelId = '11111111-1111-4111-8111-111111111111';
const ownerUserId = '22222222-2222-4222-8222-222222222222';
const reviewerUserId = '33333333-3333-4333-8333-333333333333';

const entity = (overrides: Partial<HotelEntity> = {}): HotelEntity =>
  Object.assign(new HotelEntity(), {
    id: hotelId,
    ownerUserId,
    placeId: null,
    name: 'Sun Hotel',
    legalName: 'Sun Hotel Company',
    taxCode: 'TAX001',
    description: null,
    address: '1 Beach Road',
    phoneNumber: '0912345678',
    email: 'hotel@example.com',
    starRating: 4,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    status: HotelStatus.DRAFT,
    submittedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    documents: [],
    createdAt: new Date('2026-11-08T00:00:00.000Z'),
    updatedAt: new Date('2026-11-08T00:00:00.000Z'),
    ...overrides,
  });

describe('Hotels API (e2e)', () => {
  let app: INestApplication<App>;
  const service = {
    create: jest.fn(),
    findPage: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    addDocument: jest.fn(),
    deleteDocument: jest.fn(),
    submit: jest.fn(),
    deactivate: jest.fn(),
    review: jest.fn(),
    findReviewHistory: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HotelsController, AdminHotelsController],
      providers: [{ provide: HotelsService, useValue: service }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(
      (
        currentRequest: AuthenticatedRequest,
        _response: Response,
        next: NextFunction,
      ) => {
        const isAdminRoute = currentRequest.originalUrl.includes('/admin/');
        currentRequest.authUser = {
          id: isAdminRoute ? reviewerUserId : ownerUserId,
          role: isAdminRoute ? UserRole.ADMIN : UserRole.HOTEL_OWNER,
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

  it('creates a draft hotel and returns its location', async () => {
    service.create.mockResolvedValue(entity());

    await request(app.getHttpServer())
      .post('/api/v1/hotels')
      .send({
        name: 'Sun Hotel',
        legalName: 'Sun Hotel Company',
        taxCode: 'TAX001',
        address: '1 Beach Road',
        phoneNumber: '0912345678',
        email: 'hotel@example.com',
        starRating: 4,
        checkInTime: '14:00',
        checkOutTime: '12:00',
      })
      .expect(201)
      .expect('Location', `/api/v1/hotels/${hotelId}`)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: hotelId,
          ownerUserId,
          status: HotelStatus.DRAFT,
        });
      });
  });

  it('does not allow callers to set the initial hotel status', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/hotels')
      .send({
        name: 'Sun Hotel',
        legalName: 'Sun Hotel Company',
        taxCode: 'TAX001',
        address: '1 Beach Road',
        phoneNumber: '0912345678',
        email: 'hotel@example.com',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        status: HotelStatus.ACTIVE,
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_FAILED');
      });
  });

  it('does not allow callers to choose another hotel owner', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/hotels')
      .send({
        ownerUserId: '99999999-9999-4999-8999-999999999999',
        name: 'Sun Hotel',
        legalName: 'Sun Hotel Company',
        taxCode: 'TAX001',
        address: '1 Beach Road',
        phoneNumber: '0912345678',
        email: 'hotel@example.com',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_FAILED'));
  });

  it('adds a business license document', async () => {
    service.addDocument.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      hotelId,
      documentType: HotelDocumentType.BUSINESS_LICENSE,
      documentNumber: 'BL-001',
      fileUrl: 'https://files.example.com/license.pdf',
      issuedAt: '2026-01-01',
      expiresAt: '2030-01-01',
      createdAt: new Date('2026-11-08T00:00:00.000Z'),
      updatedAt: new Date('2026-11-08T00:00:00.000Z'),
    });

    await request(app.getHttpServer())
      .post(`/api/v1/hotels/${hotelId}/documents`)
      .send({
        documentType: HotelDocumentType.BUSINESS_LICENSE,
        documentNumber: 'BL-001',
        fileUrl: 'https://files.example.com/license.pdf',
        issuedAt: '2026-01-01',
        expiresAt: '2030-01-01',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.documentType).toBe(HotelDocumentType.BUSINESS_LICENSE);
      });
  });

  it('submits a hotel for approval', async () => {
    service.submit.mockResolvedValue(
      entity({ status: HotelStatus.PENDING_APPROVAL }),
    );

    await request(app.getHttpServer())
      .put(`/api/v1/hotels/${hotelId}/submit`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(HotelStatus.PENDING_APPROVAL);
      });
  });

  it('uses one admin endpoint for hotel review actions', async () => {
    service.review.mockResolvedValue(entity({ status: HotelStatus.ACTIVE }));

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/hotels/${hotelId}/status`)
      .send({ action: HotelReviewCommand.APPROVE })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(HotelStatus.ACTIVE);
      });

    expect(service.review).toHaveBeenCalledWith(hotelId, reviewerUserId, {
      action: HotelReviewCommand.APPROVE,
    });
  });

  it('requires a reason when rejecting a hotel', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/hotels/${hotelId}/status`)
      .send({ action: HotelReviewCommand.REJECT })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_FAILED');
      });
  });

  it('does not allow callers to choose the reviewer identity', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/hotels/${hotelId}/status`)
      .send({
        reviewerUserId: '99999999-9999-4999-8999-999999999999',
        action: HotelReviewCommand.APPROVE,
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_FAILED'));
  });
});
