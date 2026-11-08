import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { AuthController } from '../src/modules/auth/controllers/auth.controller';
import { GoogleAccountLinkRequiredException } from '../src/modules/auth/exceptions/auth.exceptions';
import { AccessSessionGuard } from '../src/modules/auth/guards/access-session.guard';
import { TrustedOriginGuard } from '../src/modules/auth/guards/trusted-origin.guard';
import { AuthService } from '../src/modules/auth/services/auth.service';
import {
  UserEntity,
  UserRole,
  UserStatus,
} from '../src/modules/users/entities/user.entity';

const frontendOrigin = 'http://localhost:5173';
const entity = Object.assign(new UserEntity(), {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'traveler',
  email: 'traveler@example.com',
  passwordHash: null,
  googleAccountId: 'google-subject',
  firstName: null,
  lastName: null,
  displayName: 'Traveler',
  phoneNumber: null,
  dateOfBirth: null,
  gender: null,
  status: UserStatus.ACTIVE,
  role: UserRole.TOURIST,
  isEmailVerified: true,
  createdAt: new Date('2026-11-09T00:00:00.000Z'),
  updatedAt: new Date('2026-11-09T00:00:00.000Z'),
  deletedAt: null,
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
    beginGoogleLogin: jest.fn(),
    completeGoogleLogin: jest.fn(),
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

  it('starts Google login with a local return path', async () => {
    service.beginGoogleLogin.mockResolvedValue(
      'https://accounts.google.com/o/oauth2/v2/auth?state=state',
    );

    await request(app.getHttpServer())
      .get('/api/v1/auth/google/start?returnTo=%2Ftrips')
      .expect(302)
      .expect(
        'Location',
        'https://accounts.google.com/o/oauth2/v2/auth?state=state',
      );
    expect(service.beginGoogleLogin.mock.calls).toContainEqual(['/trips']);
  });

  it('rejects an external return path at validation', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/google/start?returnTo=https://attacker.example')
      .expect(400);
  });

  it('sets application cookies and redirects after Google callback', async () => {
    service.completeGoogleLogin.mockResolvedValue({
      user: entity,
      returnTo: '/trips',
      ...tokens,
    });

    const response = await request(app.getHttpServer())
      .get(
        '/api/v1/auth/google/callback?code=code&state=state&scope=openid&authuser=0',
      )
      .expect(302)
      .expect(
        'Location',
        'http://localhost:5173/auth/google/complete?returnTo=%2Ftrips',
      );

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/login_access=access-token;.*HttpOnly/),
        expect.stringMatching(/login_refresh=refresh-token;.*HttpOnly/),
      ]),
    );
  });

  it('redirects safely when an existing email requires account linking', async () => {
    service.completeGoogleLogin.mockRejectedValue(
      new GoogleAccountLinkRequiredException(),
    );

    await request(app.getHttpServer())
      .get('/api/v1/auth/google/callback?code=code&state=state')
      .expect(302)
      .expect(
        'Location',
        'http://localhost:5173/auth/login?error=account_link_required',
      );
  });

  it('rotates cookies only for the configured frontend origin', async () => {
    service.refresh.mockResolvedValue({ user: entity, ...tokens });

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', frontendOrigin)
      .set('Cookie', 'login_refresh=old-refresh')
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', 'login_refresh=old-refresh')
      .expect(403);
  });

  it('returns the user identified by the access cookie', async () => {
    service.authenticate.mockResolvedValue(entity);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', 'login_access=access-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(entity.id);
        expect(body).not.toHaveProperty('passwordHash');
      });
  });
});
