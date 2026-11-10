import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { ActivitiesController } from '../src/modules/activities/controllers/activities.controller';
import { ActivityEntity } from '../src/modules/activities/entities/activity.entity';
import { ActivitiesService } from '../src/modules/activities/services/activities.service';
import { ItinerariesController } from '../src/modules/itineraries/controllers/itineraries.controller';
import {
  ItineraryEntity,
  ItineraryStatus,
} from '../src/modules/itineraries/entities/itinerary.entity';
import { ItinerariesService } from '../src/modules/itineraries/services/itineraries.service';
import { StopoversController } from '../src/modules/stopovers/controllers/stopovers.controller';
import { StopoverEntity } from '../src/modules/stopovers/entities/stopover.entity';
import { StopoversService } from '../src/modules/stopovers/services/stopovers.service';

const itineraryId = '11111111-1111-4111-8111-111111111111';
const stopoverId = '22222222-2222-4222-8222-222222222222';
const activityId = '33333333-3333-4333-8333-333333333333';
const touristUserId = '44444444-4444-4444-8444-444444444444';
const placeId = '55555555-5555-4555-8555-555555555555';
const createdAt = new Date('2026-11-05T00:00:00.000Z');

describe('Itinerary management API (e2e)', () => {
  let app: INestApplication<App>;
  const itinerariesService = {
    create: jest.fn(),
    findPage: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const stopoversService = {
    create: jest.fn(),
    findPage: jest.fn(),
    findByItineraryAndId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const activitiesService = {
    create: jest.fn(),
    findPage: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [
        ItinerariesController,
        StopoversController,
        ActivitiesController,
      ],
      providers: [
        { provide: ItinerariesService, useValue: itinerariesService },
        { provide: StopoversService, useValue: stopoversService },
        { provide: ActivitiesService, useValue: activitiesService },
      ],
    }).compile();
    app = module.createNestApplication();
    configureHttpApplication(app);
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterEach(async () => app.close());

  it('creates an itinerary and returns its location', async () => {
    itinerariesService.create.mockResolvedValue(
      Object.assign(new ItineraryEntity(), {
        id: itineraryId,
        touristUserId,
        name: 'Central Vietnam',
        description: null,
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        timezone: 'Asia/Ho_Chi_Minh',
        adultCount: 2,
        childCount: 0,
        budget: null,
        currency: 'VND',
        status: ItineraryStatus.DRAFT,
        isAiGenerated: false,
        createdAt,
        updatedAt: createdAt,
      }),
    );

    await request(app.getHttpServer())
      .post('/api/v1/itineraries')
      .send({
        touristUserId,
        name: 'Central Vietnam',
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        adultCount: 2,
      })
      .expect(201)
      .expect('Location', `/api/v1/itineraries/${itineraryId}`);
  });

  it('creates a stopover under an itinerary', async () => {
    stopoversService.create.mockResolvedValue(
      Object.assign(new StopoverEntity(), {
        id: stopoverId,
        itineraryId,
        placeId,
        stopOrder: 1,
        arrivalTime: new Date('2026-12-01T01:00:00.000Z'),
        departureTime: new Date('2026-12-01T03:00:00.000Z'),
        description: null,
        createdAt,
        updatedAt: createdAt,
      }),
    );
    await request(app.getHttpServer())
      .post(`/api/v1/itineraries/${itineraryId}/stopovers`)
      .send({
        placeId,
        stopOrder: 1,
        arrivalTime: '2026-12-01T01:00:00.000Z',
        departureTime: '2026-12-01T03:00:00.000Z',
      })
      .expect(201)
      .expect(
        'Location',
        `/api/v1/itineraries/${itineraryId}/stopovers/${stopoverId}`,
      );
  });

  it('creates an activity without accepting unknown fields', async () => {
    activitiesService.create.mockResolvedValue(
      Object.assign(new ActivityEntity(), {
        id: activityId,
        stopoverId,
        activityOrder: 1,
        name: 'Museum',
        description: null,
        startTime: new Date('2026-12-01T01:00:00.000Z'),
        endTime: new Date('2026-12-01T03:00:00.000Z'),
        estimatedCost: null,
        currency: 'VND',
        createdAt,
        updatedAt: createdAt,
      }),
    );
    await request(app.getHttpServer())
      .post(`/api/v1/stopovers/${stopoverId}/activities`)
      .send({
        activityOrder: 1,
        name: 'Museum',
        startTime: '2026-12-01T01:00:00.000Z',
        endTime: '2026-12-01T03:00:00.000Z',
      })
      .expect(201)
      .expect(
        'Location',
        `/api/v1/stopovers/${stopoverId}/activities/${activityId}`,
      );

    await request(app.getHttpServer())
      .post(`/api/v1/stopovers/${stopoverId}/activities`)
      .send({
        activityOrder: 1,
        name: 'Museum',
        startTime: '2026-12-01T01:00:00.000Z',
        endTime: '2026-12-01T03:00:00.000Z',
        unknown: true,
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_FAILED'));
  });
});
