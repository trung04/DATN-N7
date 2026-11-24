import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { RoomsController } from '../src/modules/rooms/controllers/rooms.controller';
import { RoomsService } from '../src/modules/rooms/services/rooms.service';
import { ROOM_REPOSITORY, type FindRoomsOptions } from '../src/modules/rooms/interfaces/room.repository.interface';
import { RoomEntity, RoomOperationalStatus } from '../src/modules/rooms/entities/room.entity';
import { AmenitiesService } from '../src/modules/amenities/services/amenities.service';
import { HotelsService } from '../src/modules/hotels/services/hotels.service';
import { AccessSessionGuard } from '../src/modules/auth/guards/access-session.guard';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { RolesGuard } from '../src/modules/authorization/guards/roles.guard';
import { UserRole } from '../src/modules/users/entities/user.entity';
import { AuthorizationDeniedException } from '../src/modules/authorization/exceptions/authorization.exceptions';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';

const owned = '11111111-1111-4111-8111-111111111111';
const foreign = '22222222-2222-4222-8222-222222222222';
const rows = Array.from({ length: 128 }, (_, index) => ({
  room: Object.assign(new RoomEntity(), {
    id: String(index), hotelId: index < 125 ? owned : foreign,
    roomNumber: `R${index}`, roomType: 'Deluxe', maxOccupancy: 2,
    pricePerNight: 500000, currency: 'VND', description: null,
    operationalStatus: RoomOperationalStatus.AVAILABLE,
    createdAt: new Date(), updatedAt: new Date(),
  }), amenityIds: [],
}));

describe('Managed rooms (HTTP)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [RoomsService,
        { provide: ROOM_REPOSITORY, useValue: { findPage: async (options: FindRoomsOptions) => {
          const scoped = rows.filter(({ room }) => (!options.hotelIds || options.hotelIds.includes(room.hotelId)) && (!options.hotelId || room.hotelId === options.hotelId));
          return { items: scoped.slice((options.page - 1) * options.limit, options.page * options.limit), total: scoped.length };
        } } },
        { provide: AmenitiesService, useValue: { findExistingByIds: async () => [] } },
        { provide: HotelsService, useValue: {
          findOwnedIds: async (id: string) => id === 'owner' ? [owned] : [],
          assertManagedBy: async (id: string) => { if (id !== owned) throw new AuthorizationDeniedException(); },
        } },
        { provide: AuthService, useValue: { authenticate: async (token: string) => ({ id: token, role: token === 'tourist' ? UserRole.TOURIST : UserRole.HOTEL_OWNER }) } },
        { provide: APP_GUARD, useClass: AccessSessionGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });
  afterAll(async () => app.close());

  it('returns all owned rooms across pages, including records after 100', async () => {
    const ids: string[] = [];
    for (let page = 1; page <= 7; page++) {
      const response = await request(app.getHttpServer()).get(`/api/v1/rooms/mine?page=${page}&limit=20`).set('Cookie', 'login_access=owner').expect(200);
      expect(response.body.meta).toEqual({ page, limit: 20, total: 125 });
      expect(response.body.data.every((row: { hotelId: string }) => row.hotelId === owned)).toBe(true);
      ids.push(...response.body.data.map((row: { id: string }) => row.id));
    }
    expect(new Set(ids).size).toBe(125);
  });
  it('rejects anonymous and tourist requests', async () => {
    await request(app.getHttpServer()).get('/api/v1/rooms/mine').expect(401);
    await request(app.getHttpServer()).get('/api/v1/rooms/mine').set('Cookie', 'login_access=tourist').expect(403);
  });
  it('rejects foreign hotel filtering and caller supplied ownership', async () => {
    await request(app.getHttpServer()).get(`/api/v1/rooms/mine?hotelId=${foreign}`).set('Cookie', 'login_access=owner').expect(403);
    await request(app.getHttpServer()).get('/api/v1/rooms/mine?ownerUserId=owner').set('Cookie', 'login_access=other').expect(400);
  });
  it.each(['page=0', 'page=1.5', 'limit=101', 'hotelId=bad'])('validates %s', async query => {
    await request(app.getHttpServer()).get(`/api/v1/rooms/mine?${query}`).set('Cookie', 'login_access=owner').expect(400);
  });
  it('returns an empty list for an owner without hotels and for pages past the end', async () => {
    const empty = await request(app.getHttpServer()).get('/api/v1/rooms/mine').set('Cookie', 'login_access=other').expect(200);
    expect(empty.body.meta.total).toBe(0);
    const pastEnd = await request(app.getHttpServer()).get('/api/v1/rooms/mine?page=8').set('Cookie', 'login_access=owner').expect(200);
    expect(pastEnd.body.data).toEqual([]);
    expect(pastEnd.body.meta.total).toBe(125);
  });
  it('retains the public listing route', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/rooms?limit=1').expect(200);
    expect(response.body.meta.total).toBe(128);
  });
});
