import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import sharp from 'sharp';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { RoomImagesController } from '../src/modules/rooms/controllers/room-images.controller';
import { RoomImagesService } from '../src/modules/rooms/services/room-images.service';
import { RoomImageManagementGuard } from '../src/modules/rooms/guards/room-image-management.guard';
import {
  ROOM_IMAGE_REPOSITORY,
  type CreateRoomImageData,
} from '../src/modules/rooms/interfaces/room-image.repository.interface';
import { HOTEL_IMAGE_STORAGE } from '../src/modules/hotels/interfaces/hotel-image-storage.interface';
import { HotelsService } from '../src/modules/hotels/services/hotels.service';
import { HotelStatus } from '../src/modules/hotels/entities/hotel.entity';
import { HotelImageNotFoundException } from '../src/modules/hotels/exceptions/hotel-image.exceptions';
import { AuthorizationDeniedException } from '../src/modules/authorization/exceptions/authorization.exceptions';
import { AccessSessionGuard } from '../src/modules/auth/guards/access-session.guard';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { RolesGuard } from '../src/modules/authorization/guards/roles.guard';
import { UserRole } from '../src/modules/users/entities/user.entity';
import { ImageStorageProvider } from '../src/modules/media/entities/image.entity';
import { RoomImageEntity } from '../src/modules/rooms/entities/room-image.entity';

const roomId = '22222222-2222-4222-8222-222222222222';
describe('Room images (HTTP)', () => {
  let app: INestApplication<App>;
  let png: Buffer;
  let status = HotelStatus.ACTIVE;
  const records = new Map<string, RoomImageEntity>();
  const objects = new Map<string, Buffer>();
  const storage = {
    put: jest.fn(async (key: string, data: Buffer) => {
      objects.set(key, data);
    }),
    get: jest.fn(async (key: string) => {
      const data = objects.get(key);
      if (!data) throw new HotelImageNotFoundException();
      return data;
    }),
    delete: jest.fn(async (key: string) => {
      objects.delete(key);
    }),
  };
  beforeAll(async () => {
    png = await sharp({
      create: { width: 16, height: 12, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const module = await Test.createTestingModule({
      controllers: [RoomImagesController],
      providers: [
        RoomImagesService,
        RoomImageManagementGuard,
        {
          provide: HotelsService,
          useValue: {
            assertManagedBy: async (
              _id: string,
              actor: { id: string; role: UserRole },
            ) => {
              if (actor.id !== 'owner' && actor.role !== UserRole.ADMIN)
                throw new AuthorizationDeniedException();
              return { status };
            },
            assertActive: async () => {
              if (status !== HotelStatus.ACTIVE)
                throw new HotelImageNotFoundException();
            },
          },
        },
        {
          provide: ROOM_IMAGE_REPOSITORY,
          useValue: {
            room: async (id: string) =>
              id === roomId ? { id, hotelId: 'hotel' } : null,
            list: async () =>
              [...records.values()].sort((a, b) => a.imageOrder - b.imageOrder),
            find: async (room: string, id: string) =>
              room === roomId ? (records.get(id) ?? null) : null,
            create: async (data: CreateRoomImageData) => {
              const row = Object.assign(new RoomImageEntity(), {
                id: data.id,
                roomId: data.roomId,
                imageId: data.id,
                imageOrder: records.size + 1,
                createdAt: new Date(),
                image: {
                  ...data,
                  storageProvider: ImageStorageProvider.MINIO,
                  fallbackUrl: null,
                  sourceProvider: null,
                  sourceUrl: null,
                  attributionText: null,
                },
              });
              records.set(row.id, row);
              return row;
            },
            delete: async (_room: string, id: string) => {
              records.delete(id);
            },
            makePrimary: async (_room: string, id: string) => {
              const chosen = records.get(id);
              if (!chosen) return null;
              const others = [...records.values()]
                .filter((row) => row.id !== id)
                .sort((a, b) => a.imageOrder - b.imageOrder);
              chosen.imageOrder = 1;
              others.forEach((row, index) => {
                row.imageOrder = index + 2;
              });
              return chosen;
            },
          },
        },
        { provide: HOTEL_IMAGE_STORAGE, useValue: storage },
        {
          provide: AuthService,
          useValue: {
            authenticate: async (token: string) => ({
              id: token,
              role:
                token === 'tourist'
                  ? UserRole.TOURIST
                  : token === 'admin'
                    ? UserRole.ADMIN
                    : UserRole.HOTEL_OWNER,
            }),
          },
        },
        { provide: APP_GUARD, useClass: AccessSessionGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });
  beforeEach(() => {
    records.clear();
    objects.clear();
    jest.clearAllMocks();
    status = HotelStatus.ACTIVE;
  });
  afterAll(async () => {
    await app.close();
  });
  const upload = () =>
    request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/images`)
      .set('Cookie', 'login_access=owner')
      .attach('file', png, { filename: 'room.png', contentType: 'image/png' });
  it('uploads, lists publicly, chooses a cover, previews and deletes', async () => {
    const first = await upload().expect(201);
    const second = await upload().expect(201);
    expect(first.headers.location).toBe(first.body.url);
    expect(first.body).toMatchObject({
      roomId,
      contentType: 'image/webp',
      width: 16,
      height: 12,
      illustrative: false,
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/rooms/${roomId}/images/${second.body.id}/primary`)
      .set('Cookie', 'login_access=owner')
      .expect(200);
    const list = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${roomId}/images`)
      .expect(200);
    expect(list.body.map((row: { id: string }) => row.id)).toEqual([
      second.body.id,
      first.body.id,
    ]);
    await request(app.getHttpServer())
      .get(second.body.url)
      .expect(200)
      .expect('Content-Type', /image\/webp/);
    await request(app.getHttpServer())
      .get(second.body.previewUrl)
      .set('Cookie', 'login_access=owner')
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/rooms/${roomId}/images/${second.body.id}`)
      .set('Cookie', 'login_access=owner')
      .expect(204);
    await request(app.getHttpServer()).get(second.body.url).expect(404);
  });
  it.each([
    ['', 401],
    ['tourist', 403],
    ['other-owner', 403],
  ] as const)(
    'rejects upload for %s before decoding invalid image bytes',
    async (token, code) => {
      const req = request(app.getHttpServer()).post(
        `/api/v1/rooms/${roomId}/images`,
      );
      if (token) req.set('Cookie', `login_access=${token}`);
      await req
        .attach('file', Buffer.from('invalid image'), {
          filename: 'bad.png',
          contentType: 'image/png',
        })
        .expect(code);
      expect(storage.put).not.toHaveBeenCalled();
    },
  );
  it('validates actual bytes, MIME, size and UUID', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/images`)
      .set('Cookie', 'login_access=owner')
      .attach('file', Buffer.from('fake'), 'room.png')
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/images`)
      .set('Cookie', 'login_access=owner')
      .attach('file', png, { filename: 'room.jpg', contentType: 'image/jpeg' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/rooms/${roomId}/images`)
      .set('Cookie', 'login_access=owner')
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'room.png')
      .expect(413);
    await request(app.getHttpServer())
      .get('/api/v1/rooms/invalid/images')
      .expect(400);
  });
  it('conceals inactive photos publicly but allows owner preview and locks pending mutations', async () => {
    const created = await upload().expect(201);
    status = HotelStatus.PENDING_APPROVAL;
    await request(app.getHttpServer()).get(created.body.url).expect(404);
    await request(app.getHttpServer())
      .get(created.body.previewUrl)
      .set('Cookie', 'login_access=owner')
      .expect(200);
    await upload().expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/rooms/${roomId}/images/${created.body.id}/primary`)
      .set('Cookie', 'login_access=owner')
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/api/v1/rooms/${roomId}/images/${created.body.id}`)
      .set('Cookie', 'login_access=owner')
      .expect(409);
  });
  it('forbids a different owner from listing, changing cover, previewing or deleting', async () => {
    const created = await upload().expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/rooms/mine/${roomId}/images`)
      .set('Cookie', 'login_access=other-owner')
      .expect(403);
    await request(app.getHttpServer())
      .get(created.body.previewUrl)
      .set('Cookie', 'login_access=other-owner')
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/rooms/${roomId}/images/${created.body.id}/primary`)
      .set('Cookie', 'login_access=other-owner')
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/v1/rooms/${roomId}/images/${created.body.id}`)
      .set('Cookie', 'login_access=other-owner')
      .expect(403);
  });
});
