import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import type { AuthenticatedRequest } from '../src/modules/auth/interfaces/authenticated-request.interface';
import { RolesGuard } from '../src/modules/authorization/guards/roles.guard';
import { PlacesController } from '../src/modules/places/controllers/places.controller';
import { PlaceEntity, PlaceStatus } from '../src/modules/places/entities/place.entity';
import { PlacesService } from '../src/modules/places/services/places.service';
import { UserRole } from '../src/modules/users/entities/user.entity';

describe('Place photos (e2e)', () => {
  const url = '/api/v1/places';
  const id = '11111111-1111-4111-8111-111111111111';
  const imageId = '22222222-2222-4222-8222-222222222222';
  const imageUrl = `${url}/${id}/images/${imageId}/file`;
  const bytes = Buffer.from('image bytes');
  const input = { name: 'Lake', latitude: 21.0285, longitude: 105.8542 };
  let app: INestApplication<App>;
  const service = {
    create: jest.fn(),
    update: jest.fn(),
    findDetailsById: jest.fn(),
    readImage: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PlacesController],
      providers: [
        { provide: PlacesService, useValue: service },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      if (req.headers['x-test-admin'] === 'yes') req.authUser = { id, role: UserRole.ADMIN } as never;
      next();
    });
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const place = Object.assign(new PlaceEntity(), { id, ...input, status: PlaceStatus.ACTIVE });
    service.create.mockResolvedValue(place);
    service.update.mockResolvedValue(place);
    service.findDetailsById.mockResolvedValue({
      place, categories: [], tags: [], price: null, primaryImageUrl: imageUrl,
      images: [{ imageUrl, altText: 'Lake' }],
    });
  });

  afterAll(async () => { await app.close(); });

  it('creates with multipart data and returns the public image URL', async () => {
    await request(app.getHttpServer()).post(url)
      .set('x-test-admin', 'yes')
      .field('data', JSON.stringify(input))
      .attach('file', bytes, { filename: 'lake.png', contentType: 'image/png' })
      .expect(201)
      .expect('Location', `${url}/${id}`)
      .expect(({ body }) => expect(body.primaryImageUrl).toBe(imageUrl));

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...input, status: PlaceStatus.ACTIVE }),
      expect.objectContaining({ buffer: bytes, mimetype: 'image/png' }),
    );
  });

  it('keeps JSON updates compatible and accepts multipart replacement', async () => {
    await request(app.getHttpServer()).patch(`${url}/${id}`).set('x-test-admin', 'yes')
      .send({ name: 'New name' }).expect(200);
    expect(service.update).toHaveBeenLastCalledWith(id, expect.objectContaining({ name: 'New name' }), undefined);

    await request(app.getHttpServer()).patch(`${url}/${id}`).set('x-test-admin', 'yes')
      .field('data', '{}')
      .attach('file', bytes, { filename: 'lake.png', contentType: 'image/png' })
      .expect(200);
    expect(service.update).toHaveBeenLastCalledWith(id, expect.anything(), expect.objectContaining({ buffer: bytes }));
  });

  it('validates the multipart payload before writing', async () => {
    await request(app.getHttpServer()).post(url).set('x-test-admin', 'yes')
      .field('data', JSON.stringify({ ...input, extra: true }))
      .attach('file', bytes, { filename: 'lake.png', contentType: 'image/png' })
      .expect(400);
    await request(app.getHttpServer()).post(url).set('x-test-admin', 'yes')
      .field('data', JSON.stringify(input))
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'lake.png', contentType: 'image/png' })
      .expect(413);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('accepts a file at the 5 MiB limit', async () => {
    await request(app.getHttpServer()).post(url).set('x-test-admin', 'yes')
      .field('data', JSON.stringify(input))
      .attach('file', Buffer.alloc(5 * 1024 * 1024), { filename: 'lake.png', contentType: 'image/png' })
      .expect(201);
    expect(service.create.mock.calls[0][1].buffer).toHaveLength(5 * 1024 * 1024);
  });

  it('requires an administrator to upload and serves linked photos publicly', async () => {
    await request(app.getHttpServer()).post(url)
      .field('data', JSON.stringify(input))
      .attach('file', bytes, { filename: 'lake.png', contentType: 'image/png' })
      .expect(403);
    expect(service.create).not.toHaveBeenCalled();

    service.readImage.mockResolvedValue(bytes);
    await request(app.getHttpServer()).get(imageUrl)
      .expect(200).expect('Content-Type', /image\/webp/).expect('X-Content-Type-Options', 'nosniff');
    expect(service.readImage).toHaveBeenCalledWith(id, imageId);
  });
});
