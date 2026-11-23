import { ItineraryRouteResponse } from '../dtos/responses/itinerary-route.response';
import { ItineraryRouteEntity } from '../entities/itinerary-route.entity';

export class ItineraryRouteMapper {
  static toResponse(entity: ItineraryRouteEntity): ItineraryRouteResponse {
    return {
      id: entity.id,
      itineraryId: entity.itineraryId,
      routeDate: entity.routeDate,
      profile: entity.profile,
      provider: entity.provider,
      status: entity.status,
      geometry: entity.geometry,
      distanceMeters: entity.distanceMeters,
      durationSeconds: entity.durationSeconds,
      waypoints: entity.waypoints,
      legs: entity.legs,
      generatedAt: entity.generatedAt.toISOString(),
      expiresAt: entity.expiresAt.toISOString(),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
