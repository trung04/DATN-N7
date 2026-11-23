import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DirectionsProvider,
  DirectionsRouteResult,
} from '../../interfaces/directions-provider.interface';
import {
  MapboxDirectionsNotConfiguredException,
  MapboxDirectionsRateLimitedException,
  MapboxDirectionsResponseException,
  MapboxDirectionsUnavailableException,
} from '../../exceptions/itinerary-route.exceptions';

interface MapboxDirectionsPayload {
  code?: unknown;
  uuid?: unknown;
  routes?: Array<{
    geometry?: unknown;
    distance?: unknown;
    duration?: unknown;
    legs?: Array<{ distance?: unknown; duration?: unknown }>;
  }>;
  waypoints?: Array<{ location?: unknown }>;
}

@Injectable()
export class MapboxDirectionsClient implements DirectionsProvider {
  constructor(private readonly config: ConfigService) {}

  async getRoute(
    input: Parameters<DirectionsProvider['getRoute']>[0],
  ): Promise<DirectionsRouteResult> {
    const token =
      this.config.get<string>('MAPBOX_DIRECTIONS_ACCESS_TOKEN') ?? '';
    if (!token) throw new MapboxDirectionsNotConfiguredException();

    const coordinates = input.waypoints
      .map(({ location }) => `${location[0]},${location[1]}`)
      .join(';');
    const url = new URL(
      `https://api.mapbox.com/directions/v5/mapbox/${input.profile}/${coordinates}`,
    );
    url.searchParams.set('access_token', token);
    url.searchParams.set('alternatives', 'false');
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'full');
    url.searchParams.set('steps', 'false');

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get<number>('MAPBOX_DIRECTIONS_TIMEOUT_MS') ?? 8000,
    );
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.status === 429) {
        throw new MapboxDirectionsRateLimitedException();
      }
      if (response.status >= 500) {
        throw new MapboxDirectionsUnavailableException();
      }
      const payload = (await response
        .json()
        .catch(() => null)) as MapboxDirectionsPayload | null;
      if (!response.ok || !payload) {
        throw new MapboxDirectionsResponseException();
      }
      return this.parsePayload(payload, input.waypoints.length);
    } catch (error) {
      if (
        error instanceof MapboxDirectionsRateLimitedException ||
        error instanceof MapboxDirectionsUnavailableException ||
        error instanceof MapboxDirectionsResponseException
      ) {
        throw error;
      }
      throw new MapboxDirectionsUnavailableException();
    } finally {
      clearTimeout(timeout);
    }
  }

  private parsePayload(
    payload: MapboxDirectionsPayload,
    waypointCount: number,
  ): DirectionsRouteResult {
    const route = payload.routes?.[0];
    const geometry = route?.geometry as
      | {
          type?: unknown;
          coordinates?: unknown;
        }
      | undefined;
    const coordinates = geometry?.coordinates;
    const snappedLocations = payload.waypoints?.map((waypoint) =>
      this.coordinate(waypoint.location),
    );
    const legs = route?.legs?.map((leg) => ({
      distanceMeters: this.nonNegativeInteger(leg.distance),
      durationSeconds: this.nonNegativeInteger(leg.duration),
    }));

    if (
      payload.code !== 'Ok' ||
      geometry?.type !== 'LineString' ||
      !Array.isArray(coordinates) ||
      coordinates.length < 2 ||
      coordinates.length > 100_000 ||
      !snappedLocations ||
      snappedLocations.length !== waypointCount ||
      !legs ||
      legs.length !== waypointCount - 1
    ) {
      throw new MapboxDirectionsResponseException();
    }

    return {
      geometry: {
        type: 'LineString',
        coordinates: coordinates.map((coordinate) =>
          this.coordinate(coordinate),
        ),
      },
      distanceMeters: this.nonNegativeInteger(route?.distance),
      durationSeconds: this.nonNegativeInteger(route?.duration),
      snappedLocations,
      legs,
      providerRouteRef:
        typeof payload.uuid === 'string' ? payload.uuid.slice(0, 200) : null,
    };
  }

  private coordinate(value: unknown): [number, number] {
    if (
      !Array.isArray(value) ||
      value.length < 2 ||
      typeof value[0] !== 'number' ||
      typeof value[1] !== 'number' ||
      !Number.isFinite(value[0]) ||
      !Number.isFinite(value[1]) ||
      value[0] < -180 ||
      value[0] > 180 ||
      value[1] < -90 ||
      value[1] > 90
    ) {
      throw new MapboxDirectionsResponseException();
    }
    return [value[0], value[1]];
  }

  private nonNegativeInteger(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new MapboxDirectionsResponseException();
    }
    return Math.round(value);
  }
}
