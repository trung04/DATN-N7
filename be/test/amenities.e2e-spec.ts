import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { AmenitiesController } from '../src/modules/amenities/controllers/amenities.controller';
import { AmenityEntity } from '../src/modules/amenities/entities/amenity.entity';
import { AmenityNotFoundException } from '../src/modules/amenities/exceptions/amenity.exceptions';
import { AmenitiesService } from '../src/modules/amenities/services/amenities.service';

const id = '11111111-1111-4111-8111-111111111111';
const entity = Object.assign(new AmenityEntity(), {
  id,
  code: 'FREE_WIFI',
  name: 'Free Wi-Fi',
  createdAt: new Date('2026-11-03T00:00:00.000Z'),
  updatedAt: new Date('2026-11-03T00:00:00.000Z'),
});

describe('Amenities API (e2e)', () => {
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
      controllers: [AmenitiesController],
      providers: [{ provide: AmenitiesService, useValue: service }],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates an amenity and returns its location', async () => {
    service.create.mockResolvedValue(entity);

    await request(app.getHttpServer())
      .post('/api/v1/amenities')
      .send({ code: 'free_wifi', name: 'Free Wi-Fi' })
      .expect(201)
      .expect('Location', `/api/v1/amenities/${id}`)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id, code: 'FREE_WIFI' });
      });

    expect(service.create).toHaveBeenCalledWith({
      code: 'FREE_WIFI',
      name: 'Free Wi-Fi',
    });
  });

  it('rejects unknown request fields using problem details', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/amenities')
      .send({ code: 'WIFI', name: 'Wi-Fi', unknown: true })
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_FAILED');
        expect(body.errors).toEqual(expect.any(Array));
      });
  });

  it('maps a missing amenity to 404 problem details', async () => {
    service.findById.mockRejectedValue(new AmenityNotFoundException(id));

    await request(app.getHttpServer())
      .get(`/api/v1/amenities/${id}`)
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/)
      .expect(({ body }) => {
        expect(body.code).toBe('AMENITY_NOT_FOUND');
      });
  });
});
