import type {
  ItineraryRouteLeg,
  ItineraryRouteProfile,
  ItineraryRouteStatus,
  ItineraryRouteWaypoint,
  RouteLineString,
} from '../../entities/itinerary-route.entity';

export class ItineraryRouteResponse {
  id: string;
  itineraryId: string;
  routeDate: string;
  profile: ItineraryRouteProfile;
  provider: 'MAPBOX';
  status: ItineraryRouteStatus;
  geometry: RouteLineString;
  distanceMeters: number;
  durationSeconds: number;
  waypoints: ItineraryRouteWaypoint[];
  legs: ItineraryRouteLeg[];
  generatedAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}
