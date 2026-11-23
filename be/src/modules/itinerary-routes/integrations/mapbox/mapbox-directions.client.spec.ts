import type { ConfigService } from '@nestjs/config';
import { ItineraryRouteProfile } from '../../entities/itinerary-route.entity';
import {
  MapboxDirectionsRateLimitedException,
  MapboxDirectionsResponseException,
} from '../../exceptions/itinerary-route.exceptions';
import { MapboxDirectionsClient } from './mapbox-directions.client';

describe('MapboxDirectionsClient', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'MAPBOX_DIRECTIONS_ACCESS_TOKEN') return 'test-token';
      if (key === 'MAPBOX_DIRECTIONS_TIMEOUT_MS') return 1000;
      return undefined;
    }),
  };
  const client = new MapboxDirectionsClient(config as unknown as ConfigService);
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('requests GeoJSON and validates a usable route response', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'Ok',
          uuid: 'route-ref',
          waypoints: [
            { location: [105.8, 21.02] },
            { location: [105.81, 21.03] },
          ],
          routes: [
            {
              geometry: {
                type: 'LineString',
                coordinates: [
                  [105.8, 21.02],
                  [105.81, 21.03],
                ],
              },
              distance: 1500.4,
              duration: 420.2,
              legs: [{ distance: 1500.4, duration: 420.2 }],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await client.getRoute({
      profile: ItineraryRouteProfile.DRIVING,
      waypoints: [
        { stopoverId: 'one', order: 1, location: [105.8, 21.02] },
        { stopoverId: 'two', order: 2, location: [105.81, 21.03] },
      ],
    });

    const requestedUrl = new URL(
      (global.fetch as jest.Mock).mock.calls[0][0] as URL,
    );
    expect(requestedUrl.pathname).toContain('/directions/v5/mapbox/driving/');
    expect(requestedUrl.searchParams.get('geometries')).toBe('geojson');
    expect(requestedUrl.searchParams.get('overview')).toBe('full');
    expect(result.distanceMeters).toBe(1500);
    expect(result.durationSeconds).toBe(420);
  });

  it('maps provider throttling to a stable domain error', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('{}', { status: 429 }));

    await expect(
      client.getRoute({
        profile: ItineraryRouteProfile.WALKING,
        waypoints: [
          { stopoverId: 'one', order: 1, location: [105.8, 21.02] },
          { stopoverId: 'two', order: 2, location: [105.81, 21.03] },
        ],
      }),
    ).rejects.toBeInstanceOf(MapboxDirectionsRateLimitedException);
  });

  it('rejects malformed geometry instead of persisting it', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'Ok',
          waypoints: [{ location: [105.8, 21.02] }],
          routes: [{ geometry: { type: 'Point', coordinates: [] } }],
        }),
        { status: 200 },
      ),
    );

    await expect(
      client.getRoute({
        profile: ItineraryRouteProfile.DRIVING,
        waypoints: [
          { stopoverId: 'one', order: 1, location: [105.8, 21.02] },
          { stopoverId: 'two', order: 2, location: [105.81, 21.03] },
        ],
      }),
    ).rejects.toBeInstanceOf(MapboxDirectionsResponseException);
  });
});
