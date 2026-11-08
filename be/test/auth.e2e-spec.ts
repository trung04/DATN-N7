import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { AuthController } from '../src/modules/auth/controllers/auth.controller';
import { InvalidCredentialsException } from '../src/modules/auth/exceptions/auth.exceptions';
import { AccessSessionGuard } from '../src/modules/auth/guards/access-session.guard';
import { TrustedOriginGuard } from '../src/modules/auth/guards/trusted-origin.guard';
import { AuthService } from '../src/modules/auth/services/auth.service';
import {
  UserEntity,
  UserRole,
  UserStatus,
} from '../src/modules/users/entities/user.entity';

const frontendOrigin = 'http://localhost:5173';
const id = '11111111-1111-4111-8111-111111111111';
const entity = Object.assign(new UserEntity(), {
  id,
  username: 'traveler',
  email: 'traveler@example.com',
  passwordHash: '$2b$12$secret-hash',
  googleAccountId: null,
  firstName: null,
  lastName: null,
  displayName: null,
  phoneNumber: null,
  dateOfBirth: null,
  gender: null,
  status: UserStatus.ACTIVE,
  role: UserRole.TOURIST,
  isEmailVerified: false,
  createdAt: new Date('2026-11-07T00:00:00.000Z'),
  updatedAt: new Date('2026-11-07T00:00:00.000Z'),
});
const tokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessExpiresInMs: 60000,
  refreshExpiresInMs: 120000,
};

describe('Authentication API (e2e)', () => {
  let app: INestApplication<App>;
  const service = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    authenticate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: service },
        AccessSessionGuard,
        TrustedOriginGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test'),
            getOrThrow: jest.fn().mockReturnValue(frontendOrigin),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterEach(async () => app.close());

  it('registers with only username, email and password', async () => {
    service.register.mockResolvedValue(entity);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: 'Traveler',
        email: 'Traveler@Example.com',
        password: 'Password123',
      })
      .expect(201)
      .expect('Location', `/api/v1/users/${id}`);
  });

  it('logs in and sets separate HttpOnly access and refresh cookies', async () => {
    service.login.mockResolvedValue({ user: entity, ...tokens });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'Traveler', password: 'Password123' })
      .expect(200);

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /login_access=access-token;.*Path=\/;.*HttpOnly;.*SameSite=Lax/,
        ),
        expect.stringMatching(
          /login_refresh=refresh-token;.*Path=\/api\/v1\/auth;.*HttpOnly;.*SameSite=Lax/,
        ),
      ]),
    );
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('rotates cookies only for the configured frontend origin', async () => {
    service.refresh.mockResolvedValue({ user: entity, ...tokens });

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', frontendOrigin)
      .set('Cookie', 'login_refresh=old-refresh')
      .expect(204);
    expect(service.refresh).toHaveBeenCalledWith('old-refresh');

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', 'login_refresh=old-refresh')
      .expect(403);
  });

  it('returns the active user for an authenticated access cookie', async () => {
    service.authenticate.mockResolvedValue(entity);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', 'login_access=access-token')
      .expect(200)
      .expect(({ body }) => expect(body.id).toBe(id));
  });

  it('revokes server state and clears both cookies on logout', async () => {
    service.logout.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', frontendOrigin)
      .set('Cookie', 'login_access=access-token; login_refresh=refresh-token')
      .expect(204);

    expect(service.logout).toHaveBeenCalledWith(
      'access-token',
      'refresh-token',
    );
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/login_access=;.*Path=\//),
        expect.stringMatching(/login_refresh=;.*Path=\/api\/v1\/auth/),
      ]),
    );
  });

  it('maps invalid credentials to a safe 401 response', async () => {
    service.login.mockRejectedValue(new InvalidCredentialsException());

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'traveler', password: 'wrong-password' })
      .expect(401)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => expect(body.code).toBe('INVALID_CREDENTIALS'));
  });
});
