import {
  StopoverListResponse,
  StopoverResponse,
} from '../dtos/responses/stopover.response';
import { StopoverEntity } from '../entities/stopover.entity';

export class StopoverMapper {
  static toResponse(entity: StopoverEntity): StopoverResponse {
    return {
      id: entity.id,
      itineraryId: entity.itineraryId,
      placeId: entity.placeId,
      stopOrder: entity.stopOrder,
      arrivalTime: entity.arrivalTime.toISOString(),
      departureTime: entity.departureTime.toISOString(),
      description: entity.description,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toListResponse(
    entities: StopoverEntity[],
    page: number,
    limit: number,
    total: number,
  ): StopoverListResponse {
    return {
      data: entities.map((entity) => this.toResponse(entity)),
      meta: { page, limit, total },
    };
  }
}
