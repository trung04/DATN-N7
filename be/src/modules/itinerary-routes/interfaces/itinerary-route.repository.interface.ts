import type {
  ItineraryRouteEntity,
  ItineraryRouteLeg,
  ItineraryRouteProfile,
  ItineraryRouteWaypoint,
  RouteLineString,
} from '../entities/itinerary-route.entity';

export const ITINERARY_ROUTE_REPOSITORY = Symbol('ITINERARY_ROUTE_REPOSITORY');

export interface CreateItineraryRouteData {
  itineraryId: string;
  routeDate: string;
  profile: ItineraryRouteProfile;
  geometry: RouteLineString;
  distanceMeters: number;
  durationSeconds: number;
  waypoints: ItineraryRouteWaypoint[];
  legs: ItineraryRouteLeg[];
  waypointSignature: string;
  providerRouteRef: string | null;
  generatedAt: Date;
  expiresAt: Date;
}

export interface ItineraryRouteRepository {
  findCurrent(
    itineraryId: string,
    routeDate: string,
    profile: ItineraryRouteProfile,
  ): Promise<ItineraryRouteEntity | null>;
  replaceCurrent(data: CreateItineraryRouteData): Promise<ItineraryRouteEntity>;
  markStale(route: ItineraryRouteEntity): Promise<void>;
  delete(route: ItineraryRouteEntity): Promise<void>;
  purgeExpired(now: Date): Promise<number>;
}
