import type {
  ItineraryRouteProfile,
  RouteLineString,
} from '../entities/itinerary-route.entity';

export const DIRECTIONS_PROVIDER = Symbol('DIRECTIONS_PROVIDER');

export interface DirectionsWaypointInput {
  stopoverId: string;
  order: number;
  location: [number, number];
}

export interface DirectionsRouteResult {
  geometry: RouteLineString;
  distanceMeters: number;
  durationSeconds: number;
  snappedLocations: [number, number][];
  legs: Array<{ distanceMeters: number; durationSeconds: number }>;
  providerRouteRef: string | null;
}

export interface DirectionsProvider {
  getRoute(input: {
    profile: ItineraryRouteProfile;
    waypoints: DirectionsWaypointInput[];
  }): Promise<DirectionsRouteResult>;
}
