import {
  ActivityListResponse,
  ActivityResponse,
} from '../dtos/responses/activity.response';
import { ActivityEntity } from '../entities/activity.entity';

export class ActivityMapper {
  static toResponse(entity: ActivityEntity): ActivityResponse {
    return {
      id: entity.id,
      stopoverId: entity.stopoverId,
      activityOrder: entity.activityOrder,
      name: entity.name,
      description: entity.description,
      startTime: entity.startTime.toISOString(),
      endTime: entity.endTime.toISOString(),
      estimatedCost: entity.estimatedCost,
      currency: entity.currency,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toListResponse(
    entities: ActivityEntity[],
    page: number,
    limit: number,
    total: number,
  ): ActivityListResponse {
    return {
      data: entities.map((entity) => this.toResponse(entity)),
      meta: { page, limit, total },
    };
  }
}
