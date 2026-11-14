import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { CancellationPoliciesController } from '../src/modules/cancellation-policies/controllers/cancellation-policies.controller';
import { CancellationPolicyEntity } from '../src/modules/cancellation-policies/entities/cancellation-policy.entity';
import { CancellationPolicyNotFoundException } from '../src/modules/cancellation-policies/exceptions/cancellation-policy.exceptions';
import { CancellationPoliciesService } from '../src/modules/cancellation-policies/services/cancellation-policies.service';

const hotelId = '11111111-1111-4111-8111-111111111111';
const policyId = '22222222-2222-4222-8222-222222222222';
const entity = Object.assign(new CancellationPolicyEntity(), {
  id: policyId,
  hotelId,
  name: 'Flexible',
  cancelHours: 24,
  penaltyPercent: 10,
  cancellationAllowed: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  description: 'Cancel up to two days before check-in.',
});

describe('Cancellation Policies API (e2e)', () => {
  let app: INestApplication<App>;
  const service = {
    create: jest.fn(),
    findPage: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CancellationPoliciesController],
      providers: [{ provide: CancellationPoliciesService, useValue: service }],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a cancellation policy and returns its location', async () => {
    service.create.mockResolvedValue(entity);

    await request(app.getHttpServer())
      .post('/api/v1/cancellation-policies')
      .send({
        hotelId,
        name: ' Flexible ',
        cancelHours: 24,
        penaltyPercent: 10,
      })
      .expect(201)
      .expect('Location', `/api/v1/cancellation-policies/${policyId}`)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: policyId,
          hotelId,
          name: 'Flexible',
          cancelHours: 24,
          penaltyPercent: 10,
        });
        expect(body).not.toHaveProperty('hotelOwnerUserId');
      });
  });

  it('rejects hotelOwnerUserId because it is not in the API contract', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cancellation-policies')
      .send({
        hotelId,
        name: 'Flexible',
        hotelOwnerUserId: '33333333-3333-4333-8333-333333333333',
      })
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_FAILED');
      });
  });

  it('rejects a penalty above one hundred percent', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cancellation-policies')
      .send({ hotelId, name: 'Invalid fee', cancelHours: 24, penaltyPercent: 100.01 })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_FAILED');
      });
  });

  it('maps a missing policy to problem details', async () => {
    service.findById.mockRejectedValue(
      new CancellationPolicyNotFoundException(policyId),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/cancellation-policies/${policyId}`)
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('CANCELLATION_POLICY_NOT_FOUND');
      });
  });

  it('deletes a policy without returning a body', async () => {
    service.delete.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete(`/api/v1/cancellation-policies/${policyId}`)
      .expect(204);
  });
});
