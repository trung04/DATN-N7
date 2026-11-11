import { Inject, Injectable } from '@nestjs/common';
import { HotelsService } from '../../hotels/services/hotels.service';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { CreateCancellationPolicyRequest } from '../dtos/requests/create-cancellation-policy.request';
import { ListCancellationPoliciesRequest } from '../dtos/requests/list-cancellation-policies.request';
import { UpdateCancellationPolicyRequest } from '../dtos/requests/update-cancellation-policy.request';
import { CancellationPolicyEntity } from '../entities/cancellation-policy.entity';
import {
  CancellationPolicyNameConflictException,
  CancellationPolicyNotFoundException,
  EmptyCancellationPolicyUpdateException,
  InvalidCancellationPolicyRangeException,
} from '../exceptions/cancellation-policy.exceptions';
import { CANCELLATION_POLICY_REPOSITORY } from '../interfaces/cancellation-policy.repository.interface';
import type {
  CancellationPolicyPage,
  CancellationPolicyRepository,
} from '../interfaces/cancellation-policy.repository.interface';

@Injectable()
export class CancellationPoliciesService {
  constructor(
    @Inject(CANCELLATION_POLICY_REPOSITORY)
    private readonly repository: CancellationPolicyRepository,
    private readonly hotelsService: HotelsService,
  ) {}

  async create(
    input: CreateCancellationPolicyRequest,
    actor: AuthorizationActor,
  ): Promise<CancellationPolicyEntity> {
    await this.hotelsService.assertManagedBy(input.hotelId, actor);
    await this.hotelsService.assertActive(input.hotelId);
    const name = input.name.trim();
    if (await this.repository.findByHotelAndName(input.hotelId, name)) {
      throw new CancellationPolicyNameConflictException(input.hotelId, name);
    }
    const minHours = input.minHoursBeforeCheckIn ?? 0;
    const maxHours = input.maxHoursBeforeCheckIn ?? null;
    this.assertRange(minHours, maxHours);
    await this.assertNoOverlap(input.hotelId, minHours, maxHours);

    return this.repository.create({
      hotelId: input.hotelId,
      name,
      cancellationWindow: input.cancellationWindow ?? null,
      minHoursBeforeCheckIn: minHours,
      maxHoursBeforeCheckIn: maxHours,
      cancellationFeeRate: input.cancellationFeeRate ?? null,
      description: this.normalizeNullable(input.description),
    });
  }

  findPage(
    input: ListCancellationPoliciesRequest,
  ): Promise<CancellationPolicyPage> {
    return this.repository.findPage({
      page: input.page,
      limit: input.limit,
      search: input.search,
      hotelId: input.hotelId,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
  }

  async findById(id: string): Promise<CancellationPolicyEntity> {
    const policy = await this.repository.findById(id);
    if (!policy) throw new CancellationPolicyNotFoundException(id);
    return policy;
  }

  async update(
    id: string,
    input: UpdateCancellationPolicyRequest,
    actor: AuthorizationActor,
  ): Promise<CancellationPolicyEntity> {
    if (this.isEmptyUpdate(input)) {
      throw new EmptyCancellationPolicyUpdateException();
    }
    const policy = await this.findById(id);
    await this.hotelsService.assertManagedBy(policy.hotelId, actor);

    if (input.minHoursBeforeCheckIn !== undefined || input.maxHoursBeforeCheckIn !== undefined) {
      const minHours = input.minHoursBeforeCheckIn ?? policy.minHoursBeforeCheckIn;
      const maxHours = input.maxHoursBeforeCheckIn !== undefined
        ? input.maxHoursBeforeCheckIn
        : policy.maxHoursBeforeCheckIn;
      this.assertRange(minHours, maxHours);
      await this.assertNoOverlap(policy.hotelId, minHours, maxHours, policy.id);
      policy.minHoursBeforeCheckIn = minHours;
      policy.maxHoursBeforeCheckIn = maxHours;
    }

    if (input.name !== undefined) {
      const name = input.name.trim();
      const duplicate = await this.repository.findByHotelAndName(
        policy.hotelId,
        name,
      );
      if (duplicate && duplicate.id !== policy.id) {
        throw new CancellationPolicyNameConflictException(policy.hotelId, name);
      }
      policy.name = name;
    }
    if (input.cancellationWindow !== undefined) {
      policy.cancellationWindow = input.cancellationWindow;
    }
    if (input.cancellationFeeRate !== undefined) {
      policy.cancellationFeeRate = input.cancellationFeeRate;
    }
    if (input.description !== undefined) {
      policy.description = this.normalizeNullable(input.description);
    }

    return this.repository.save(policy);
  }

  async delete(id: string, actor: AuthorizationActor): Promise<void> {
    const policy = await this.findById(id);
    await this.hotelsService.assertManagedBy(policy.hotelId, actor);
    await this.repository.delete(policy);
  }

  private isEmptyUpdate(input: UpdateCancellationPolicyRequest): boolean {
    return [
      input.name,
      input.cancellationWindow,
      input.minHoursBeforeCheckIn,
      input.maxHoursBeforeCheckIn,
      input.cancellationFeeRate,
      input.description,
    ].every((value) => value === undefined);
  }

  private assertRange(min: number, max: number | null): void {
    if (min < 0 || (max !== null && max <= min)) {
      throw new InvalidCancellationPolicyRangeException(
        'Giờ bắt đầu phải nhỏ hơn giờ kết thúc; để trống giờ kết thúc nếu không giới hạn.',
      );
    }
  }

  private async assertNoOverlap(
    hotelId: string,
    min: number,
    max: number | null,
    excludeId?: string,
  ): Promise<void> {
    const policies = await this.repository.findAllByHotel(hotelId);
    const overlaps = policies.some((item) =>
      item.id !== excludeId &&
      (max === null || item.minHoursBeforeCheckIn < max) &&
      (item.maxHoursBeforeCheckIn === null || min < item.maxHoursBeforeCheckIn),
    );
    if (overlaps) throw new InvalidCancellationPolicyRangeException();
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }
}
