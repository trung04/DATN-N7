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
import { PlatformSettingsController, PublicSettingsController } from '../src/modules/platform-settings/platform-settings.controller';
import { PlatformSettingsRepository } from '../src/modules/platform-settings/platform-settings.repository';
import type { PlatformSettingsEntity } from '../src/modules/platform-settings/platform-settings.repository';
import { PlatformSettingsService } from '../src/modules/platform-settings/platform-settings.service';
import { UserRole } from '../src/modules/users/entities/user.entity';

const path = '/api/v1/admin/settings/integrations';
const adminId = '11111111-1111-4111-8111-111111111111';
const fixtureKey = 'example-key-value-for-testing';

describe('Platform settings', () => {
  let app: INestApplication<App>;
  const rows = new Map<string, PlatformSettingsEntity>();
  const save = jest.fn(async (section: string, encryptedValue: string, revision: number, updatedBy: string) => {
    if ((rows.get(section)?.revision ?? 0) !== revision) return false;
    rows.set(section, { section, encryptedValue, revision: revision + 1, updatedBy, updatedAt: new Date() });
    return true;
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PlatformSettingsController, PublicSettingsController],
      providers: [
        PlatformSettingsService, RolesGuard,
        { provide: PlatformSettingsRepository, useValue: { findAll: async () => [...rows.values()], save } },
        { provide: ConfigService, useValue: new ConfigService({
          SETTINGS_ENCRYPTION_KEY: 'ab'.repeat(32), FRONTEND_ORIGIN: 'http://localhost:8080',
          PAYOS_CLIENT_ID: 'configured-client', PAYOS_API_KEY: 'configured-api', PAYOS_CHECKSUM_KEY: 'configured-checksum',
          HOTEL_GEOCODER_USER_AGENT: 'Travel fixture for test',
        }) },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      req.authUser = { id: adminId, role: req.headers['x-test-role'] === 'admin' ? UserRole.ADMIN : UserRole.HOTEL_OWNER } as AuthenticatedRequest['authUser'];
      next();
    });
    configureHttpApplication(app);
    app.useGlobalGuards(app.get(RolesGuard));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('restricts editing and reading administrative settings to admins', async () => {
    await request(app.getHttpServer()).get(path).expect(403);
    await request(app.getHttpServer()).put(`${path}/booking`).send({ revision: 0, values: { BOOKING_HOLD_MINUTES: 20 } }).expect(403);
    expect(save).not.toHaveBeenCalled();
  });

  it('rotates a key without exposing plaintext, preserving the payment channel', async () => {
    const first = await request(app.getHttpServer()).put(`${path}/payos-collection`).set('x-test-role', 'admin')
      .send({ revision: 0, values: { PAYOS_API_KEY: fixtureKey } }).expect(200);
    expect(first.body).toMatchObject({ revision: 1 });
    const listing = await request(app.getHttpServer()).get(path).set('x-test-role', 'admin').expect(200);
    expect(JSON.stringify(listing.body)).not.toContain(fixtureKey);
    expect(rows.get('payos-collection')?.encryptedValue).not.toContain(fixtureKey);
    expect(app.get(PlatformSettingsService).get('PAYOS_API_KEY')).toBe(fixtureKey);
    await request(app.getHttpServer()).put(`${path}/payos-collection`).set('x-test-role', 'admin')
      .send({ revision: 0, values: { PAYOS_API_KEY: 'different-key' } }).expect(409);
    await request(app.getHttpServer()).put(`${path}/payos-collection`).set('x-test-role', 'admin')
      .send({ revision: 1, values: { PAYOS_CLIENT_ID: 'other-client' } }).expect(400);
  });

  it('publishes only a validated Mapbox public token', async () => {
    await request(app.getHttpServer()).put(`${path}/map`).set('x-test-role', 'admin')
      .send({ revision: 0, values: { MAPBOX_PUBLIC_TOKEN: 'sk.secret-token-do-not-publish' } }).expect(400);
    const mapboxToken = 'pk.valid-map-token-example';
    await request(app.getHttpServer()).put(`${path}/map`).set('x-test-role', 'admin')
      .send({ revision: 0, values: { MAPBOX_PUBLIC_TOKEN: mapboxToken } }).expect(200);
    await request(app.getHttpServer()).get('/api/v1/public-settings/map').expect(200, { mapboxToken });
  });
});
