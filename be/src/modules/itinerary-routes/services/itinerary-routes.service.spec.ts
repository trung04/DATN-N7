import type { ConfigService } from '@nestjs/config';
import type { ItinerariesService } from '../../itineraries/services/itineraries.service';
import type { PlacesService } from '../../places/services/places.service';
import type { StopoversService } from '../../stopovers/services/stopovers.service';
import { ItineraryStatus } from '../../itineraries/entities/itinerary.entity';
import type { ItineraryEntity } from '../../itineraries/entities/itinerary.entity';
import type { StopoverEntity } from '../../stopovers/entities/stopover.entity';
import {
  ItineraryRouteEntity,
  ItineraryRouteProfile,
  ItineraryRouteStatus,
} from '../entities/itinerary-route.entity';
import {
  ItineraryRouteExpiredException,
  ItineraryRouteStaleException,
} from '../exceptions/itinerary-route.exceptions';
import type { DirectionsProvider } from '../interfaces/directions-provider.interface';
import type { ItineraryRouteRepository } from '../interfaces/itinerary-route.repository.interface';
import { ItineraryRoutesService } from './itinerary-routes.service';

describe('ItineraryRoutesService', () => {
  const repository: jest.Mocked<ItineraryRouteRepository> = {
    findCurrent: jest.fn(),
    replaceCurrent: jest.fn(),
    markStale: jest.fn(),
    delete: jest.fn(),
    purgeExpired: jest.fn(),
  };
  const directionsProvider: jest.Mocked<DirectionsProvider> = {
    getRoute: jest.fn(),
  };
  const itinerariesService = { findByIdForTourist: jest.fn() };
  const stopoversService = { findByItineraryForTourist: jest.fn() };
  const placesService = { findById: jest.fn() };
  const config = {
    get: jest.fn((key: string) =>
      key === 'MAPBOX_ROUTE_STORAGE_TTL_DAYS' ? 30 : undefined,
    ),
  };
  const service = new ItineraryRoutesService(
    repository,
    directionsProvider,
    itinerariesService as unknown as ItinerariesService,
    stopoversService as unknown as StopoversService,
    placesService as unknown as PlacesService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    itinerariesService.findByIdForTourist.mockResolvedValue(itinerary());
    stopoversService.findByItineraryForTourist.mockResolvedValue(stopovers());
  });

  it('generates, normalizes and stores a route with a bounded expiry', async () => {
    repository.findCurrent.mockResolvedValue(null);
    directionsProvider.getRoute.mockResolvedValue({
      geometry: {
        type: 'LineString',
        coordinates: [
          [105.8, 21.02],
          [105.81, 21.03],
        ],
      },
      distanceMeters: 1500,
      durationSeconds: 420,
      snappedLocations: [
        [105.8, 21.02],
        [105.81, 21.03],
      ],
      legs: [{ distanceMeters: 1500, durationSeconds: 420 }],
      providerRouteRef: 'mapbox-route-ref',
    });
    repository.replaceCurrent.mockImplementation(async (data) =>
      route({ ...data }),
    );

    const result = await service.generate(
      ITINERARY_ID,
      { routeDate: '2026-12-01', profile: ItineraryRouteProfile.DRIVING },
      USER_ID,
    );

    expect(directionsProvider.getRoute.mock.calls[0][0]).toEqual({
      profile: ItineraryRouteProfile.DRIVING,
      waypoints: [
        { stopoverId: STOP_1, order: 1, location: [105.8, 21.02] },
        { stopoverId: STOP_2, order: 2, location: [105.81, 21.03] },
      ],
    });
    const stored = repository.replaceCurrent.mock.calls[0][0];
    expect(stored.waypointSignature).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.expiresAt.getTime() - stored.generatedAt.getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
    expect(result.legs[0]).toEqual({
      fromStopoverId: STOP_1,
      toStopoverId: STOP_2,
      distanceMeters: 1500,
      durationSeconds: 420,
    });
  });

  it('deletes an expired payload before reporting it as gone', async () => {
    const expired = route({ expiresAt: new Date(Date.now() - 1000) });
    repository.findCurrent.mockResolvedValue(expired);

    await expect(
      service.findCurrent(
        ITINERARY_ID,
        { routeDate: '2026-12-01', profile: ItineraryRouteProfile.DRIVING },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(ItineraryRouteExpiredException);
    expect(repository.delete.mock.calls[0][0]).toBe(expired);
    expect(stopoversService.findByItineraryForTourist).not.toHaveBeenCalled();
  });

  it('marks a current route stale when its waypoint signature no longer matches', async () => {
    const current = route({ waypointSignature: '0'.repeat(64) });
    repository.findCurrent.mockResolvedValue(current);

    await expect(
      service.findCurrent(
        ITINERARY_ID,
        { routeDate: '2026-12-01', profile: ItineraryRouteProfile.DRIVING },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(ItineraryRouteStaleException);
    expect(repository.markStale.mock.calls[0][0]).toBe(current);
  });
});

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ITINERARY_ID = '22222222-2222-4222-8222-222222222222';
const STOP_1 = '33333333-3333-4333-8333-333333333333';
const STOP_2 = '44444444-4444-4444-8444-444444444444';

function itinerary(): ItineraryEntity {
  return {
    id: ITINERARY_ID,
    touristUserId: USER_ID,
    name: 'Hanoi',
    destinationCity: 'Hanoi',
    description: null,
    startDate: '2026-12-01',
    endDate: '2026-12-03',
    timezone: 'Asia/Ho_Chi_Minh',
    adultCount: 1,
    childCount: 0,
    budget: null,
    currency: 'VND',
    status: ItineraryStatus.SAVED,
    isAiGenerated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function stopovers(): StopoverEntity[] {
  return [
    stopover(STOP_1, 1, 105.8, 21.02, '2026-12-01T02:00:00.000Z'),
    stopover(STOP_2, 2, 105.81, 21.03, '2026-12-01T05:00:00.000Z'),
  ];
}

function stopover(
  id: string,
  order: number,
  longitude: number,
  latitude: number,
  arrival: string,
): StopoverEntity {
  return {
    id,
    itineraryId: ITINERARY_ID,
    placeId: null,
    customName: `Stop ${order}`,
    customAddress: null,
    latitude,
    longitude,
    stopOrder: order,
    arrivalTime: new Date(arrival),
    departureTime: new Date(new Date(arrival).getTime() + 60 * 60 * 1000),
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function route(
  overrides: Partial<ItineraryRouteEntity> = {},
): ItineraryRouteEntity {
  const generatedAt = overrides.generatedAt ?? new Date();
  return {
    id: '55555555-5555-4555-8555-555555555555',
    itineraryId: ITINERARY_ID,
    routeDate: '2026-12-01',
    profile: ItineraryRouteProfile.DRIVING,
    provider: 'MAPBOX',
    status: ItineraryRouteStatus.CURRENT,
    geometry: {
      type: 'LineString',
      coordinates: [
        [105.8, 21.02],
        [105.81, 21.03],
      ],
    },
    distanceMeters: 1500,
    durationSeconds: 420,
    waypoints: [],
    legs: [],
    waypointSignature: 'a'.repeat(64),
    providerRouteRef: null,
    generatedAt,
    expiresAt:
      overrides.expiresAt ?? new Date(generatedAt.getTime() + 86_400_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
