import {
  CancellationPolicyListResponse,
  CancellationPolicyResponse,
} from '../dtos/responses/cancellation-policy.response';
import { CancellationPolicyEntity } from '../entities/cancellation-policy.entity';

export class CancellationPolicyMapper {
  static toResponse(
    policy: CancellationPolicyEntity,
  ): CancellationPolicyResponse {
    return {
      id: policy.id,
      hotelId: policy.hotelId,
      name: policy.name,
      cancellationWindow: policy.cancellationWindow,
      minHoursBeforeCheckIn: policy.minHoursBeforeCheckIn,
      maxHoursBeforeCheckIn: policy.maxHoursBeforeCheckIn,
      cancellationFeeRate: policy.cancellationFeeRate,
      description: policy.description,
    };
  }

  static toListResponse(
    policies: CancellationPolicyEntity[],
    page: number,
    limit: number,
    total: number,
  ): CancellationPolicyListResponse {
    return {
      data: policies.map((policy) => this.toResponse(policy)),
      meta: { page, limit, total },
    };
  }
}
