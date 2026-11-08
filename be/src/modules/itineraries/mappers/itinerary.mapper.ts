import {
  ItineraryListResponse,
  ItineraryResponse,
} from '../dtos/responses/itinerary.response';
import { ItineraryEntity } from '../entities/itinerary.entity';

export class ItineraryMapper {
  static toResponse(entity: ItineraryEntity): ItineraryResponse {
    return {
      id: entity.id,
      touristUserId: entity.touristUserId,
      name: entity.name,
      description: entity.description,
      startDate: entity.startDate,
      endDate: entity.endDate,
      timezone: entity.timezone,
      adultCount: entity.adultCount,
      childCount: entity.childCount,
      budget: entity.budget,
      currency: entity.currency,
      status: entity.status,
      isAiGenerated: entity.isAiGenerated,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toListResponse(
    entities: ItineraryEntity[],
    page: number,
    limit: number,
    total: number,
  ): ItineraryListResponse {
    return {
      data: entities.map((entity) => this.toResponse(entity)),
      meta: { page, limit, total },
    };
  }
}
