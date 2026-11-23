import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ItineraryEntity } from '../../itineraries/entities/itinerary.entity';
import { ItinerariesService } from '../../itineraries/services/itineraries.service';
import { PlacesService } from '../../places/services/places.service';
import type { StopoverEntity } from '../../stopovers/entities/stopover.entity';
import { StopoversService } from '../../stopovers/services/stopovers.service';
import type { RouteQueryRequest } from '../dtos/requests/route-query.request';
import {
  ItineraryRouteEntity,
  type ItineraryRouteLeg,
  type ItineraryRouteWaypoint,
} from '../entities/itinerary-route.entity';
import {
  ItineraryRouteDateException,
  ItineraryRouteExpiredException,
  ItineraryRouteNotFoundException,
  ItineraryRouteStaleException,
  ItineraryRouteWaypointsException,
} from '../exceptions/itinerary-route.exceptions';
import { DIRECTIONS_PROVIDER } from '../interfaces/directions-provider.interface';
import type {
  DirectionsProvider,
  DirectionsWaypointInput,
} from '../interfaces/directions-provider.interface';
import { ITINERARY_ROUTE_REPOSITORY } from '../interfaces/itinerary-route.repository.interface';
import type { ItineraryRouteRepository } from '../interfaces/itinerary-route.repository.interface';

@Injectable()
export class ItineraryRoutesService {
  constructor(
    @Inject(ITINERARY_ROUTE_REPOSITORY)
    private readonly repository: ItineraryRouteRepository,
    @Inject(DIRECTIONS_PROVIDER)
    private readonly directionsProvider: DirectionsProvider,
    private readonly itinerariesService: ItinerariesService,
    private readonly stopoversService: StopoversService,
    private readonly placesService: PlacesService,
    private readonly config: ConfigService,
  ) {}

  async findCurrent(
    itineraryId: string,
    query: RouteQueryRequest,
    touristUserId: string,
  ): Promise<ItineraryRouteEntity> {
    const itinerary = await this.itinerariesService.findByIdForTourist(
      itineraryId,
      touristUserId,
    );
    this.assertRouteDate(itinerary, query.routeDate);
    const route = await this.repository.findCurrent(
      itineraryId,
      query.routeDate,
      query.profile,
    );
    if (!route) throw new ItineraryRouteNotFoundException();
    if (this.isExpired(route)) {
      await this.repository.delete(route);
      throw new ItineraryRouteExpiredException(route.expiresAt);
    }

    const waypoints = await this.resolveWaypoints(
      itinerary,
      query.routeDate,
      touristUserId,
    );
    if (route.waypointSignature !== this.signature(query.profile, waypoints)) {
      await this.repository.markStale(route);
      throw new ItineraryRouteStaleException();
    }
    return route;
  }

  async generate(
    itineraryId: string,
    input: RouteQueryRequest,
    touristUserId: string,
  ): Promise<ItineraryRouteEntity> {
    const itinerary = await this.itinerariesService.findByIdForTourist(
      itineraryId,
      touristUserId,
    );
    this.assertRouteDate(itinerary, input.routeDate);
    const waypoints = await this.resolveWaypoints(
      itinerary,
      input.routeDate,
      touristUserId,
    );
    if (waypoints.length < 2) throw new ItineraryRouteWaypointsException();

    const waypointSignature = this.signature(input.profile, waypoints);
    const current = await this.repository.findCurrent(
      itineraryId,
      input.routeDate,
      input.profile,
    );
    if (current) {
      if (this.isExpired(current)) {
        await this.repository.delete(current);
      } else if (current.waypointSignature === waypointSignature) {
        return current;
      } else {
        await this.repository.markStale(current);
      }
    }

    const result = await this.directionsProvider.getRoute({
      profile: input.profile,
      waypoints,
    });
    const generatedAt = new Date();
    const ttlDays =
      this.config.get<number>('MAPBOX_ROUTE_STORAGE_TTL_DAYS') ?? 30;
    const expiresAt = new Date(
      generatedAt.getTime() + ttlDays * 24 * 60 * 60 * 1000,
    );
    const storedWaypoints: ItineraryRouteWaypoint[] = waypoints.map(
      (waypoint, index) => ({
        stopoverId: waypoint.stopoverId,
        order: waypoint.order,
        requestedLocation: waypoint.location,
        snappedLocation: result.snappedLocations[index],
      }),
    );
    const legs: ItineraryRouteLeg[] = result.legs.map((leg, index) => ({
      fromStopoverId: waypoints[index].stopoverId,
      toStopoverId: waypoints[index + 1].stopoverId,
      distanceMeters: leg.distanceMeters,
      durationSeconds: leg.durationSeconds,
    }));

    return this.repository.replaceCurrent({
      itineraryId,
      routeDate: input.routeDate,
      profile: input.profile,
      geometry: result.geometry,
      distanceMeters: result.distanceMeters,
      durationSeconds: result.durationSeconds,
      waypoints: storedWaypoints,
      legs,
      waypointSignature,
      providerRouteRef: result.providerRouteRef,
      generatedAt,
      expiresAt,
    });
  }

  purgeExpired(now = new Date()): Promise<number> {
    return this.repository.purgeExpired(now);
  }

  private async resolveWaypoints(
    itinerary: ItineraryEntity,
    routeDate: string,
    touristUserId: string,
  ): Promise<DirectionsWaypointInput[]> {
    const stopovers = await this.stopoversService.findByItineraryForTourist(
      itinerary.id,
      touristUserId,
    );
    const selected = stopovers
      .filter((stopover) =>
        this.occupiesDate(stopover, routeDate, itinerary.timezone),
      )
      .sort(
        (left, right) =>
          left.arrivalTime.getTime() - right.arrivalTime.getTime() ||
          left.stopOrder - right.stopOrder ||
          left.id.localeCompare(right.id),
      );

    return Promise.all(
      selected.map(async (stopover, index) => ({
        stopoverId: stopover.id,
        order: index + 1,
        location: await this.coordinates(stopover),
      })),
    );
  }

  private async coordinates(
    stopover: StopoverEntity,
  ): Promise<[number, number]> {
    let latitude = stopover.latitude;
    let longitude = stopover.longitude;
    if (stopover.placeId) {
      const place = await this.placesService.findById(stopover.placeId);
      latitude = place.latitude;
      longitude = place.longitude;
    }
    if (
      latitude === null ||
      longitude === null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      throw new ItineraryRouteWaypointsException(
        `Stopover '${stopover.id}' does not have routable coordinates.`,
      );
    }
    return [longitude, latitude];
  }

  private occupiesDate(
    stopover: StopoverEntity,
    routeDate: string,
    timezone: string,
  ): boolean {
    const start = this.dateInTimeZone(stopover.arrivalTime, timezone);
    const end = this.dateInTimeZone(
      new Date(stopover.departureTime.getTime() - 1),
      timezone,
    );
    return start <= routeDate && routeDate <= end;
  }

  private dateInTimeZone(value: Date, timezone: string): string {
    const parts = new Map(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .formatToParts(value)
        .map((part) => [part.type, part.value]),
    );
    return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
  }

  private signature(
    profile: RouteQueryRequest['profile'],
    waypoints: DirectionsWaypointInput[],
  ): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          profile,
          waypoints: waypoints.map((waypoint) => [
            waypoint.stopoverId,
            waypoint.order,
            waypoint.location[0],
            waypoint.location[1],
          ]),
        }),
      )
      .digest('hex');
  }

  private assertRouteDate(itinerary: ItineraryEntity, routeDate: string): void {
    if (routeDate < itinerary.startDate || routeDate > itinerary.endDate) {
      throw new ItineraryRouteDateException();
    }
  }

  private isExpired(route: ItineraryRouteEntity): boolean {
    return route.expiresAt.getTime() <= Date.now();
  }
}
