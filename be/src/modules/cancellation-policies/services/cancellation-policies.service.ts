import { Inject, Injectable } from '@nestjs/common';
import { CreateCancellationPolicyRequest } from '../dtos/requests/create-cancellation-policy.request';
import { ListCancellationPoliciesRequest } from '../dtos/requests/list-cancellation-policies.request';
import { UpdateCancellationPolicyRequest } from '../dtos/requests/update-cancellation-policy.request';
import { CancellationPolicyEntity } from '../entities/cancellation-policy.entity';
import {
  CancellationPolicyNameConflictException,
  CancellationPolicyNotFoundException,
  EmptyCancellationPolicyUpdateException,
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
  ) {}

  async create(
    input: CreateCancellationPolicyRequest,
  ): Promise<CancellationPolicyEntity> {
    const name = input.name.trim();
    if (await this.repository.findByHotelAndName(input.hotelId, name)) {
      throw new CancellationPolicyNameConflictException(input.hotelId, name);
    }

    return this.repository.create({
      hotelId: input.hotelId,
      name,
      cancellationWindow: input.cancellationWindow ?? null,
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
  ): Promise<CancellationPolicyEntity> {
    if (this.isEmptyUpdate(input)) {
      throw new EmptyCancellationPolicyUpdateException();
    }
    const policy = await this.findById(id);

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

  async delete(id: string): Promise<void> {
    const policy = await this.findById(id);
    await this.repository.delete(policy);
  }

  private isEmptyUpdate(input: UpdateCancellationPolicyRequest): boolean {
    return [
      input.name,
      input.cancellationWindow,
      input.cancellationFeeRate,
      input.description,
    ].every((value) => value === undefined);
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }
}
