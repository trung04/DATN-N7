import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { AmenityEntity } from '../src/modules/amenities/entities/amenity.entity';
import { RoomsController } from '../src/modules/rooms/controllers/rooms.controller';
import {
  RoomOperationalStatus,
  RoomEntity,
} from '../src/modules/rooms/entities/room.entity';
import { RoomNotFoundException } from '../src/modules/rooms/exceptions/room.exceptions';
import { RoomsService } from '../src/modules/rooms/services/rooms.service';

const roomId = '11111111-1111-4111-8111-111111111111';
const hotelId = '22222222-2222-4222-8222-222222222222';
const amenityId = '33333333-3333-4333-8333-333333333333';
const room = Object.assign(new RoomEntity(), {
  id: roomId,
  hotelId,
  roomNumber: 'A101',
  maxOccupancy: 2,
  pricePerNight: 750000,
  currency: 'VND',
  description: null,
  operationalStatus: RoomOperationalStatus.AVAILABLE,
  roomType: 'DELUXE',
  createdAt: new Date('2026-11-03T00:00:00.000Z'),
  updatedAt: new Date('2026-11-03T00:00:00.000Z'),
});
const amenity = Object.assign(new AmenityEntity(), {
  id: amenityId,
  code: 'FREE_WIFI',
  name: 'Free Wi-Fi',
  createdAt: new Date('2026-11-03T00:00:00.000Z'),
  updatedAt: new Date('2026-11-03T00:00:00.000Z'),
});

describe('Rooms API (e2e)', () => {
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
      controllers: [RoomsController],
      providers: [{ provide: RoomsService, useValue: service }],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a room with amenities and returns its location', async () => {
    service.create.mockResolvedValue({ room, amenities: [amenity] });

    await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .send({
        hotelId,
        roomNumber: 'a101',
        maxOccupancy: 2,
        pricePerNight: 750000,
        roomType: 'DELUXE',
        amenityIds: [amenityId],
      })
      .expect(201)
      .expect('Location', `/api/v1/rooms/${roomId}`)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: roomId,
          roomNumber: 'A101',
          amenities: [{ id: amenityId, code: 'FREE_WIFI' }],
        });
      });
  });

  it('rejects invalid room data using problem details', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .send({ hotelId, roomNumber: '', maxOccupancy: 0 })
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_FAILED');
      });
  });

  it('maps a missing room to 404 problem details', async () => {
    service.findById.mockRejectedValue(new RoomNotFoundException(roomId));

    await request(app.getHttpServer())
      .get(`/api/v1/rooms/${roomId}`)
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('ROOM_NOT_FOUND');
      });
  });
});
