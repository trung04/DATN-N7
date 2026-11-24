import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { AmenitiesController } from '../src/modules/amenities/controllers/amenities.controller';
import { AmenityEntity } from '../src/modules/amenities/entities/amenity.entity';
import { AmenitiesService } from '../src/modules/amenities/services/amenities.service';
import { AccessSessionGuard } from '../src/modules/auth/guards/access-session.guard';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { RolesGuard } from '../src/modules/authorization/guards/roles.guard';
import {
  UserEntity,
  UserRole,
  UserStatus,
} from '../src/modules/users/entities/user.entity';

const amenity = Object.assign(new AmenityEntity(), {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'FREE_WIFI',
  name: 'Free Wi-Fi',
  createdAt: new Date('2026-11-09T00:00:00.000Z'),
  updatedAt: new Date('2026-11-09T00:00:00.000Z'),
});

const user = (role: UserRole): UserEntity =>
  Object.assign(new UserEntity(), {
    id: '22222222-2222-4222-8222-222222222222',
    username: role.toLowerCase(),
    email: `${role.toLowerCase()}@example.com`,
    passwordHash: null,
    googleAccountId: null,
    firstName: null,
    lastName: null,
    displayName: null,
    phoneNumber: null,
    dateOfBirth: null,
    gender: null,
    status: UserStatus.ACTIVE,
    role,
    isEmailVerified: true,
    createdAt: new Date('2026-11-09T00:00:00.000Z'),
    updatedAt: new Date('2026-11-09T00:00:00.000Z'),
    deletedAt: null,
  });

describe('Authorization HTTP contracts (e2e)', () => {
  let app: INestApplication<App>;
  const amenitiesService = {
    create: jest.fn(),
    findPage: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const authService = { authenticate: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    amenitiesService.findPage.mockResolvedValue({ items: [amenity], total: 1 });
    amenitiesService.create.mockResolvedValue(amenity);
    authService.authenticate.mockImplementation(async (token: string) =>
      token === 'admin-session' ? user(UserRole.ADMIN) : user(UserRole.TOURIST),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AmenitiesController],
      providers: [
        { provide: AmenitiesService, useValue: amenitiesService },
        { provide: AuthService, useValue: authService },
        { provide: APP_GUARD, useClass: AccessSessionGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterEach(async () => app.close());

  it('allows anonymous access to an explicitly public read endpoint', async () => {
    await request(app.getHttpServer()).get('/api/v1/amenities').expect(200);
  });

  it('returns 401 when a protected endpoint has no session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/amenities')
      .send({ code: 'FREE_WIFI', name: 'Free Wi-Fi' })
      .expect(401)
      .expect(({ body }) => expect(body.code).toBe('INVALID_SESSION'));
  });

  it('returns 403 when a tourist calls an admin endpoint', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/amenities')
      .set('Cookie', 'login_access=tourist-session')
      .send({ code: 'FREE_WIFI', name: 'Free Wi-Fi' })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('AUTHORIZATION_DENIED'));
  });

  it('allows an admin to call the protected endpoint', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/amenities')
      .set('Cookie', 'login_access=admin-session')
      .send({ code: 'FREE_WIFI', name: 'Free Wi-Fi' })
      .expect(201);
  });
});
