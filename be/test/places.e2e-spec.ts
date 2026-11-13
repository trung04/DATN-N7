import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { PlacesController } from '../src/modules/places/controllers/places.controller';
import {
  PlaceEntity,
  PlaceSourceType,
  PlaceStatus,
} from '../src/modules/places/entities/place.entity';
import { PlaceNotFoundException } from '../src/modules/places/exceptions/place.exceptions';
import { PlacesService } from '../src/modules/places/services/places.service';

const id = '11111111-1111-4111-8111-111111111111';
const entity = Object.assign(new PlaceEntity(), {
  id,
  name: 'Hoan Kiem Lake',
  description: 'Historic lake in central Hanoi',
  address: 'Hoan Kiem, Hanoi',
  city: 'Hanoi',
  countryCode: 'VN',
  provinceCode: 'HN',
  timezone: 'Asia/Ho_Chi_Minh',
  latitude: 21.0285,
  longitude: 105.8542,
  status: PlaceStatus.ACTIVE,
  averageRating: 0,
  reviewCount: 0,
  externalProviderId: 'google-place-1',
  openingHours: { display: 'Open 24 hours' },
  estimatedVisitDurationMinutes: 60,
  amenities: [],
  bestVisitTimes: [],
  suitableFor: [],
  contactPhone: null,
  contactWebsite: null,
  sourceType: PlaceSourceType.PROVIDER,
  sourceProvider: 'LEGACY',
  sourceUrl: null,
  attributionText: null,
  licenseCode: null,
  lastRefreshedAt: null,
  catalogVersion: 1,
});
const details = {
  place: entity,
  category: 'ATTRACTION',
  primaryImageUrl: null,
  price: { minPrice: 0, maxPrice: 0, currency: 'VND' },
  categories: [{ code: 'ATTRACTION', name: 'Điểm tham quan' }],
  tags: [],
  images: [],
};

describe('Places API (e2e)', () => {
  let app: INestApplication<App>;
  const service = {
    create: jest.fn(),
    findPage: jest.fn(),
    findById: jest.fn(),
    findDetailsById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PlacesController],
      providers: [{ provide: PlacesService, useValue: service }],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a place and returns its location', async () => {
    service.create.mockResolvedValue(entity);
    service.findDetailsById.mockResolvedValue(details);

    await request(app.getHttpServer())
      .post('/api/v1/places')
      .send({
        name: ' Hoan Kiem Lake ',
        countryCode: 'vn',
        timezone: 'Asia/Ho_Chi_Minh',
        latitude: 21.0285,
        longitude: 105.8542,
      })
      .expect(201)
      .expect('Location', `/api/v1/places/${id}`)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id,
          name: 'Hoan Kiem Lake',
          countryCode: 'VN',
          averageRating: 0,
          category: 'ATTRACTION',
          price: {
            isFree: true,
            minPrice: 0,
            maxPrice: 0,
            currency: 'VND',
          },
        });
        expect(body).not.toHaveProperty('searchDocument');
      });
  });

  it('rejects attempts to write system-managed fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/places')
      .send({ name: 'Hoan Kiem Lake', averageRating: 5 })
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_FAILED');
      });
  });

  it('rejects invalid timezone identifiers', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/places')
      .send({ name: 'Hoan Kiem Lake', timezone: 'Hanoi' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_FAILED');
      });
  });

  it('maps a missing place to problem details', async () => {
    service.findDetailsById.mockRejectedValue(new PlaceNotFoundException(id));

    await request(app.getHttpServer())
      .get(`/api/v1/places/${id}`)
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('PLACE_NOT_FOUND');
      });
  });

  it('deletes a place without returning a body', async () => {
    service.delete.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete(`/api/v1/places/${id}`)
      .expect(204);
  });
});
