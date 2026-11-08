import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { UsersController } from '../src/modules/users/controllers/users.controller';
import {
  UserEntity,
  UserStatus,
} from '../src/modules/users/entities/user.entity';
import { UserNotFoundException } from '../src/modules/users/exceptions/user.exceptions';
import { UsersService } from '../src/modules/users/services/users.service';

const id = '11111111-1111-4111-8111-111111111111';
const entity = Object.assign(new UserEntity(), {
  id,
  username: 'traveler',
  email: 'traveler@example.com',
  passwordHash: '$2b$12$secret-hash',
  googleAccountId: 'google-subject-id',
  firstName: null,
  lastName: null,
  displayName: 'Traveler',
  phoneNumber: null,
  dateOfBirth: null,
  gender: null,
  status: UserStatus.ACTIVE,
  isEmailVerified: false,
  createdAt: new Date('2026-11-03T00:00:00.000Z'),
  updatedAt: new Date('2026-11-03T00:00:00.000Z'),
});

describe('Users API (e2e)', () => {
  let app: INestApplication<App>;
  const service = {
    create: jest.fn(),
    findPage: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    resetPassword: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a user without exposing password or Google identifiers', async () => {
    service.create.mockResolvedValue(entity);

    await request(app.getHttpServer())
      .post('/api/v1/users')
      .send({
        username: 'Traveler',
        email: 'Traveler@Example.com',
        password: 'Password123',
      })
      .expect(201)
      .expect('Location', `/api/v1/users/${id}`)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id,
          username: 'traveler',
          email: 'traveler@example.com',
          googleAccountLinked: true,
        });
        expect(body).not.toHaveProperty('password');
        expect(body).not.toHaveProperty('passwordHash');
        expect(body).not.toHaveProperty('googleAccountId');
      });
  });

  it('rejects attempts to supply passwordHash directly', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .send({
        username: 'traveler',
        email: 'traveler@example.com',
        password: 'Password123',
        passwordHash: 'attacker-controlled',
      })
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_FAILED');
      });
  });

  it('resets a password without returning a body', async () => {
    service.resetPassword.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .put(`/api/v1/users/${id}/password`)
      .send({ newPassword: 'NewPassword123' })
      .expect(204);
  });

  it('maps a missing user to 404 problem details', async () => {
    service.findById.mockRejectedValue(new UserNotFoundException(id));

    await request(app.getHttpServer())
      .get(`/api/v1/users/${id}`)
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('USER_NOT_FOUND');
      });
  });
});
