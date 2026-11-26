import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { InvalidSessionException } from '../src/modules/auth/exceptions/auth.exceptions';
import { AccessSessionGuard } from '../src/modules/auth/guards/access-session.guard';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { RolesGuard } from '../src/modules/authorization/guards/roles.guard';
import { HotelsService } from '../src/modules/hotels/services/hotels.service';
import { PlaceStatus } from '../src/modules/places/entities/place.entity';
import { PlacesService } from '../src/modules/places/services/places.service';
import { TravelAiController } from '../src/modules/travel-ai/controllers/travel-ai.controller';
import { FastApiTravelAiClient } from '../src/modules/travel-ai/integrations/ai/fastapi-travel-ai.client';
import { TRAVEL_AI } from '../src/modules/travel-ai/interfaces/travel-ai.integration';
import { TravelAiService } from '../src/modules/travel-ai/services/travel-ai.service';
import { PlaceSearchService } from '../src/modules/travel-ai/services/place-search.service';
import { UserRole } from '../src/modules/users/entities/user.entity';
import { TravelPreferencesService } from '../src/modules/users/services/travel-preferences.service';

const userId = '10000000-0000-4000-8000-000000000001';
const placeId = '30000000-0000-4000-8000-000000000002';
const draftId = '40000000-0000-4000-8000-000000000003';
const cookie = 'login_access=travel-ai-tourist-fixture';
const serviceKey = 'loopback-ai-test-key';
const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const planInput = {
  city: 'Đà Nẵng',
  startDate: date,
  endDate: date,
  adults: 2,
  children: 0,
  budget: 3000000,
  interests: ['Biển'],
  style: 'Cân bằng',
  note: 'Ưu tiên buổi sáng',
};

function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

describe('Travel AI facade (local HTTP upstream)', () => {
  let app: INestApplication;
  let timeout = 3000;
  let upstreamStatus = 200;
  let invalidPreview = false;
  let stall = false;
  const outbound: Array<{
    url: string | undefined;
    key: string | undefined;
    body: unknown;
  }> = [];
  const preferences = jest.fn().mockResolvedValue({
    categories: [{ code: 'NATURE', name: 'Thiên nhiên' }],
    topics: [{ code: 'BEACH', name: 'Biển' }],
  });
  const findPlaces = jest.fn();
  const searchInput = {
    page: 2,
    limit: 1,
    search: 'nơi ngắm hoàng hôn',
    city: 'Đà Nẵng',
    categoryCode: 'ATTRACTION',
    relevance: true,
  };

  async function fakeAi(req: IncomingMessage, res: ServerResponse) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk as Buffer));
    const body = JSON.parse(Buffer.concat(chunks).toString()) as unknown;
    outbound.push({
      url: req.url,
      key: req.headers['x-api-key'] as string | undefined,
      body,
    });
    if (stall) return;
    if (upstreamStatus !== 200) {
      reply(res, upstreamStatus, { detail: 'Private upstream configuration' });
      return;
    }
    if (req.url === '/api/v1/recommendations') {
      reply(res, 200, {
        user_id: userId,
        recommendations: [
          {
            place_id: placeId,
            place_type: 'Attraction',
            city: 'Đà Nẵng',
            score: 0.9,
            reasons: ['Gần biển'],
          },
        ],
      });
      return;
    }
    if (req.url === '/api/v1/search/places') {
      reply(res, 200, {
        retrieval: 'local_exact_bge_bm25_rrf',
        offset: 1,
        limit: 1,
        total: 2,
        results: [{ place_id: placeId, semantic_score: 0.8 }],
      });
      return;
    }
    reply(res, 200, {
      draft_id: draftId,
      result: {
        trip_id: draftId,
        user_id: userId,
        preview_only: true,
        saved: false,
        status: 'planned',
        timezone: 'Asia/Ho_Chi_Minh',
        start_date: date,
        party_size: 2,
        summary: 'Lịch một ngày',
        warnings: ['Tuyến ước tính'],
        days: [
          {
            date,
            activities: [
              {
                place_id: placeId,
                start_time: date + 'T09:00:00+07:00',
                end_time:
                  date +
                  (invalidPreview ? 'T08:00:00+07:00' : 'T10:00:00+07:00'),
                notes: ['Tham quan buổi sáng'],
              },
            ],
          },
        ],
      },
    });
  }

  const upstream = createServer((req, res) => {
    void fakeAi(req, res).catch(() => reply(res, 500, {}));
  });

  beforeAll(async () => {
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', resolve),
    );
    const { port } = upstream.address() as AddressInfo;
    const module = await Test.createTestingModule({
      controllers: [TravelAiController],
      providers: [
        TravelAiService,
        PlaceSearchService,
        { provide: TRAVEL_AI, useClass: FastApiTravelAiClient },
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
        { provide: APP_GUARD, useClass: AccessSessionGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              ({
                AI_API_KEY: serviceKey,
                AI_BASE_URL: `http://127.0.0.1:${port}`,
                AI_TIMEOUT_MS: timeout,
              })[key],
          },
        },
        {
          provide: AuthService,
          useValue: {
            authenticate(token: string) {
              if (token === 'travel-ai-tourist-fixture')
                return { id: userId, role: UserRole.TOURIST };
              if (token === 'travel-ai-admin-fixture')
                return { id: userId, role: UserRole.ADMIN };
              throw new InvalidSessionException();
            },
          },
        },
        {
          provide: PlacesService,
          useValue: {
            findPage: findPlaces,
            findCatalogOptions: jest.fn().mockResolvedValue({
              categories: [{ code: 'ATTRACTION', name: 'Điểm tham quan' }],
            }),
            findDetailsById: jest.fn().mockResolvedValue({
              place: {
                id: placeId,
                name: 'Địa điểm trong ứng dụng',
                city: 'Đà Nẵng',
                status: PlaceStatus.ACTIVE,
                latitude: 16,
                longitude: 108,
              },
              tags: ['Biển'],
              price: null,
            }),
          },
        },
        { provide: HotelsService, useValue: {} },
        {
          provide: TravelPreferencesService,
          useValue: { findForUser: preferences },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    configureHttpApplication(app);
    await app.init();
  });

  beforeEach(() => {
    timeout = 3000;
    upstreamStatus = 200;
    invalidPreview = false;
    stall = false;
    outbound.length = 0;
    preferences.mockClear();
    findPlaces.mockReset();
  });

  afterAll(async () => {
    await app?.close();
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  const recommend = (data: object, session = cookie) =>
    request(app.getHttpServer())
      .post('/api/v1/ai/recommendations')
      .set('Cookie', session)
      .send(data);

  it('searches anonymously and hydrates only active places from the catalog', async () => {
    findPlaces.mockResolvedValue({
      total: 1,
      items: [
        {
          place: { id: placeId, name: 'Địa điểm trong ứng dụng' },
          price: null,
        },
      ],
    });
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/places/search')
      .send(searchInput)
      .expect(200);

    expect(outbound).toEqual([
      {
        url: '/api/v1/search/places',
        key: serviceKey,
        body: {
          method: 'hybrid',
          query: searchInput.search,
          filters: { city: 'Đà Nẵng', category: 'Điểm tham quan' },
          sort_by: 'relevance',
          sort_order: 'asc',
          offset: 1,
          limit: 1,
        },
      },
    ]);
    expect(findPlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        search: undefined,
        status: PlaceStatus.ACTIVE,
        city: searchInput.city,
        categoryCode: searchInput.categoryCode,
      }),
      [placeId],
    );
    expect(response.body).toMatchObject({
      data: [{ id: placeId, name: 'Địa điểm trong ứng dụng' }],
      meta: { page: 2, limit: 1, total: 2 },
      searchMode: 'semantic',
    });
  });

  it('uses keyword search if FastAPI is unavailable', async () => {
    upstreamStatus = 503;
    findPlaces.mockResolvedValue({ total: 0, items: [] });
    await request(app.getHttpServer())
      .post('/api/v1/ai/places/search')
      .send(searchInput)
      .expect(200, {
        data: [],
        meta: { page: 2, limit: 1, total: 0 },
        searchMode: 'keyword',
      });
    expect(findPlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        ...searchInput,
        status: PlaceStatus.ACTIVE,
      }),
    );
  });

  it('protects the endpoint and rejects supplied user identity', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/ai/recommendations')
      .send({ query: 'Biển' })
      .expect(401);
    await recommend(
      { query: 'Biển' },
      'login_access=travel-ai-admin-fixture',
    ).expect(403);
    await recommend({ query: 'Biển', userId: 'someone-else' }).expect(400);
    expect(outbound).toHaveLength(0);
  });

  it('forwards saved preferences only when requested and uses local catalog links', async () => {
    const a = await recommend({
      query: '  Biển  ',
      usePreferences: true,
    }).expect(200);
    await recommend({ query: 'Biển', usePreferences: false }).expect(200);
    expect(preferences).toHaveBeenCalledTimes(1);
    expect(preferences).toHaveBeenCalledWith(userId);
    expect(outbound).toEqual([
      {
        url: '/api/v1/recommendations',
        key: serviceKey,
        body: {
          user_id: userId,
          query: 'Biển',
          mode: 'auto',
          preferences: ['Thiên nhiên', 'Biển'],
          limit: 12,
        },
      },
      {
        url: '/api/v1/recommendations',
        key: serviceKey,
        body: {
          user_id: userId,
          query: 'Biển',
          mode: 'content_rating',
          preferences: [],
          limit: 12,
        },
      },
    ]);
    expect(a.body).toEqual([
      expect.objectContaining({
        id: placeId,
        type: 'destination',
        name: 'Địa điểm trong ứng dụng',
        price: null,
        reason: 'Gần biển',
      }),
    ]);
  });

  it('turns a provider preview into a saveable draft without inventing cost', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/v1/ai/trip-planner')
      .set('Cookie', cookie)
      .send(planInput)
      .expect(200);
    expect(outbound).toEqual([
      {
        url: '/api/v1/trips/preview',
        key: serviceKey,
        body: {
          user_id: userId,
          start_date: date,
          city: 'Đà Nẵng',
          days: 1,
          party_size: 2,
          preferences: ['Biển'],
          query: 'Cân bằng. Ưu tiên buổi sáng',
          stops_per_day: 3,
          routing_provider: 'configured',
          allow_estimated_routes: true,
        },
      },
    ]);
    expect(result.body).toEqual(
      expect.objectContaining({
        trip: expect.objectContaining({
          id: draftId,
          userId,
          status: 'DRAFT',
          budget: 3000000,
        }),
        stops: [
          expect.objectContaining({
            id: draftId + '-1',
            placeId,
            start: date + 'T09:00:00+07:00',
          }),
        ],
        activities: [
          expect.objectContaining({ stopId: draftId + '-1', cost: null }),
        ],
        totalCost: null,
        warnings: ['Tuyến ước tính'],
      }),
    );
  });

  it('rejects invalid upstream time ranges', async () => {
    invalidPreview = true;
    const result = await request(app.getHttpServer())
      .post('/api/v1/ai/trip-planner')
      .set('Cookie', cookie)
      .send(planInput)
      .expect(502);
    expect(result.body.code).toBe('AI_INVALID_RESPONSE');
  });

  it.each([
    [401, 502, 'AI_UPSTREAM_ERROR'],
    [429, 429, 'AI_RATE_LIMITED'],
    [500, 502, 'AI_UPSTREAM_ERROR'],
    [503, 503, 'AI_UNAVAILABLE'],
  ])(
    'sanitizes upstream HTTP %i as HTTP %i',
    async (status, expected, code) => {
      upstreamStatus = status;
      const result = await recommend({ query: 'Biển' }).expect(expected);
      expect(result.body.code).toBe(code);
      expect(result.text).not.toContain('Private upstream configuration');
      expect(outbound).toHaveLength(1);
    },
  );

  it('bounds an unresponsive upstream without retrying', async () => {
    timeout = 80;
    stall = true;
    const result = await recommend({ query: 'Biển' }).expect(504);
    expect(result.body.code).toBe('AI_TIMEOUT');
    expect(outbound).toHaveLength(1);
  });
});
