import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { HotelLocationController } from '../src/modules/hotels/controllers/hotel-location.controller';
import { HotelLocationService } from '../src/modules/hotels/services/hotel-location.service';
import { HOTEL_GEOCODER } from '../src/modules/hotels/interfaces/hotel-geocoder.interface';
import { HotelLocationRateLimitedException, HotelLocationUnavailableException } from '../src/modules/hotels/exceptions/hotel-location.exceptions';
import { AccessSessionGuard } from '../src/modules/auth/guards/access-session.guard';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { RolesGuard } from '../src/modules/authorization/guards/roles.guard';
import { UserRole } from '../src/modules/users/entities/user.entity';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';

describe('Hotel location search (HTTP)', () => {
  let app: INestApplication<App>;
  const search = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HotelLocationController],
      providers: [HotelLocationService,
        { provide: HOTEL_GEOCODER, useValue: { search } },
        { provide: AuthService, useValue: { authenticate: async (token: string) => ({ id: token, role: token === 'tourist' ? UserRole.TOURIST : token === 'admin' ? UserRole.ADMIN : UserRole.HOTEL_OWNER }) } },
        { provide: APP_GUARD, useClass: AccessSessionGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });
  beforeEach(() => { search.mockReset(); search.mockResolvedValue([]); });
  afterAll(async () => app.close());

  it.each(['owner', 'admin'])('allows %s to search and normalizes spacing', async role => {
    const row = { id: 'node:1', address: 'Đà Nẵng', latitude: 16.06, longitude: 108.24 };
    search.mockResolvedValue([row]);
    const response = await request(app.getHttpServer()).get('/api/v1/hotels/location-search').query({ q: '  Đà   Nẵng  ' }).set('Cookie', `login_access=${role}`).expect(200);
    expect(response.body).toEqual([row]);
    expect(search).toHaveBeenCalledWith('Đà Nẵng');
  });
  it('requires authentication and denies tourists before calling the provider', async () => {
    await request(app.getHttpServer()).get('/api/v1/hotels/location-search?q=Danang').expect(401);
    await request(app.getHttpServer()).get('/api/v1/hotels/location-search?q=Danang').set('Cookie', 'login_access=tourist').expect(403);
    expect(search).not.toHaveBeenCalled();
  });
  it.each([{}, { q: '' }, { q: 'ab' }, { q: 'a'.repeat(201) }, { q: 'Danang', url: 'https://example.org' }])('validates input %j before searching', async query => {
    await request(app.getHttpServer()).get('/api/v1/hotels/location-search').query(query).set('Cookie', 'login_access=owner').expect(400);
    expect(search).not.toHaveBeenCalled();
  });
  it.each([
    [429, new HotelLocationRateLimitedException(), 'HOTEL_LOCATION_RATE_LIMITED'],
    [503, new HotelLocationUnavailableException(), 'HOTEL_LOCATION_UNAVAILABLE'],
  ])('returns a useful HTTP %s failure', async (status, error, code) => {
    search.mockRejectedValue(error);
    const response = await request(app.getHttpServer()).get('/api/v1/hotels/location-search?q=Danang').set('Cookie', 'login_access=owner').expect(status as number);
    expect(response.body.code).toBe(code);
  });
});
