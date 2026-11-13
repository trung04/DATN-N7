import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import sharp from 'sharp';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { HotelImagesController } from '../src/modules/hotels/controllers/hotel-images.controller';
import { HotelImagesService } from '../src/modules/hotels/services/hotel-images.service';
import { HotelsService } from '../src/modules/hotels/services/hotels.service';
import { HotelImageManagementGuard } from '../src/modules/hotels/guards/hotel-image-management.guard';
import { HOTEL_REPOSITORY } from '../src/modules/hotels/interfaces/hotel.repository.interface';
import { HOTEL_IMAGE_REPOSITORY } from '../src/modules/hotels/interfaces/hotel-image.repository.interface';
import { HOTEL_IMAGE_STORAGE } from '../src/modules/hotels/interfaces/hotel-image-storage.interface';
import { HotelImageEntity } from '../src/modules/hotels/entities/hotel-image.entity';
import { HotelStatus } from '../src/modules/hotels/entities/hotel.entity';
import { HotelOwnersService } from '../src/modules/hotel-owners/services/hotel-owners.service';
import { PlacesService } from '../src/modules/places/services/places.service';
import { UsersService } from '../src/modules/users/services/users.service';
import { AccessSessionGuard } from '../src/modules/auth/guards/access-session.guard';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { RolesGuard } from '../src/modules/authorization/guards/roles.guard';
import { UserRole } from '../src/modules/users/entities/user.entity';
import { HotelImageStorageException } from '../src/modules/hotels/exceptions/hotel-image.exceptions';
import type { CreateHotelImageData } from '../src/modules/hotels/interfaces/hotel-image.repository.interface';

const hotelId = '11111111-1111-4111-8111-111111111111';
describe('Hotel image uploads (HTTP)', () => {
  let app: INestApplication<App>;
  let png: Buffer;
  let status = HotelStatus.DRAFT;
  const records = new Map<string, HotelImageEntity>();
  const objects = new Map<string, Buffer>();
  const storage = {
    put: jest.fn(async (key: string, data: Buffer) => {
      objects.set(key, data);
    }),
    get: jest.fn(async (key: string) => objects.get(key)),
    delete: jest.fn(async (key: string) => {
      objects.delete(key);
    }),
  };
  beforeAll(async () => {
    png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const module = await Test.createTestingModule({
      controllers: [HotelImagesController],
      providers: [
        HotelImagesService,
        HotelsService,
        HotelImageManagementGuard,
        {
          provide: HOTEL_REPOSITORY,
          useValue: {
            findById: async (id: string) =>
              id === hotelId ? { id, ownerUserId: 'owner', status } : null,
          },
        },
        { provide: HotelOwnersService, useValue: {} },
        { provide: PlacesService, useValue: {} },
        { provide: UsersService, useValue: {} },
        {
          provide: HOTEL_IMAGE_REPOSITORY,
          useValue: {
            create: async (data: CreateHotelImageData) => {
              const row = Object.assign(new HotelImageEntity(), {
                id: data.id,
                hotelId: data.hotelId,
                imageId: data.id,
                imageOrder: records.size + 1,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                image: {
                  id: data.id,
                  objectKey: data.objectKey,
                  contentType: data.contentType,
                  byteSize: data.byteSize,
                  width: data.width,
                  height: data.height,
                },
              });
              records.set(row.id, row);
              return row;
            },
            find: async (hotel: string, id: string) => {
              const row = records.get(id);
              return row?.hotelId === hotel ? row : null;
            },
            delete: async (_hotel: string, id: string) => {
              records.delete(id);
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
    status = HotelStatus.DRAFT;
  });
  afterAll(async () => {
    await app.close();
  });
  const upload = (actor = 'owner') =>
    request(app.getHttpServer())
      .post(`/api/v1/hotels/${hotelId}/images`)
      .set('Cookie', `login_access=${actor}`);

  it('accepts multipart, returns metadata, allows owner preview, publishes only active hotels and deletes', async () => {
    const created = await upload()
      .attach('file', png, {
        filename: '../../photo.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      hotelId,
      contentType: 'image/webp',
      width: 16,
      height: 16,
    });
    expect(created.body.objectKey).toBeUndefined();
    expect(created.headers.location).toBe(created.body.url);
    await request(app.getHttpServer()).get(created.body.url).expect(409);
    await request(app.getHttpServer())
      .get(created.body.previewUrl)
      .set('Cookie', 'login_access=owner')
      .expect(200)
      .expect('Content-Type', 'image/webp');
    await request(app.getHttpServer())
      .get(created.body.previewUrl)
      .set('Cookie', 'login_access=other-owner')
      .expect(403);
    status = HotelStatus.ACTIVE;
    await request(app.getHttpServer())
      .get(created.body.url)
      .expect(200)
      .expect('X-Content-Type-Options', 'nosniff');
    await request(app.getHttpServer())
      .delete(`/api/v1/hotels/${hotelId}/images/${created.body.id}`)
      .set('Cookie', 'login_access=owner')
      .expect(204);
    await request(app.getHttpServer()).get(created.body.url).expect(404);
    expect(objects.size).toBe(0);
  });
  it('requires authentication and rejects tourists and different owners before storage', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/hotels/${hotelId}/images`)
      .attach('file', png, 'photo.png')
      .expect(401);
    for (const actor of ['tourist', 'other-owner'])
      await upload(actor).attach('file', png, 'photo.png').expect(403);
    expect(storage.put).not.toHaveBeenCalled();
  });
  it('allows admin upload and rejects a missing hotel or invalid UUID', async () => {
    await upload('admin').attach('file', png, 'photo.png').expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/hotels/22222222-2222-4222-8222-222222222222/images')
      .set('Cookie', 'login_access=owner')
      .attach('file', png, 'photo.png')
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/v1/hotels/not-a-uuid/images')
      .set('Cookie', 'login_access=owner')
      .attach('file', png, 'photo.png')
      .expect(400);
  });
  it('rejects missing files, fake images, extra files and body fields', async () => {
    await upload().send({}).expect(400);
    await upload()
      .attach('file', Buffer.from('not an image'), 'fake.png')
      .expect(400);
    await upload()
      .attach('file', png, 'one.png')
      .attach('file', png, 'two.png')
      .expect(400);
    await upload()
      .field('hotelId', 'other')
      .attach('file', png, 'photo.png')
      .expect(400);
    expect(storage.put).not.toHaveBeenCalled();
  });
  it('enforces upload size and pending approval restrictions', async () => {
    await upload()
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'big.png')
      .expect(413);
    status = HotelStatus.PENDING_APPROVAL;
    await upload().attach('file', png, 'photo.png').expect(409);
    expect(storage.put).not.toHaveBeenCalled();
  });
  it('reports an unavailable storage service without leaking storage credentials', async () => {
    storage.put.mockRejectedValueOnce(new HotelImageStorageException());
    const response = await upload()
      .attach('file', png, 'photo.png')
      .expect(503);
    expect(response.body.code).toBe('HOTEL_IMAGE_STORAGE_UNAVAILABLE');
    expect(records.size).toBe(0);
  });
});
