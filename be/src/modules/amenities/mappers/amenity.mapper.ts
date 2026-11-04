import {
  AmenityListResponse,
  AmenityResponse,
} from '../dtos/responses/amenity.response';
import { AmenityEntity } from '../entities/amenity.entity';

export class AmenityMapper {
  static toResponse(entity: AmenityEntity): AmenityResponse {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toListResponse(
    entities: AmenityEntity[],
    page: number,
    limit: number,
    total: number,
  ): AmenityListResponse {
    return {
      data: entities.map((entity) => this.toResponse(entity)),
      meta: { page, limit, total },
    };
  }
}
