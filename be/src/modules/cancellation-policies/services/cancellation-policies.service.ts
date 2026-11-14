import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { HotelsService } from '../../hotels/services/hotels.service';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { CreateCancellationPolicyRequest } from '../dtos/requests/create-cancellation-policy.request';
import { ListCancellationPoliciesRequest } from '../dtos/requests/list-cancellation-policies.request';
import { UpdateCancellationPolicyRequest } from '../dtos/requests/update-cancellation-policy.request';
import { CancellationPolicyEntity } from '../entities/cancellation-policy.entity';
import {
  CancellationPolicyActiveConflictException,
  CancellationPolicyDescriptionRequiredException,
  CancellationPolicyNameConflictException,
  CancellationPolicyNotFoundException,
  CancellationPolicyRequiredException,
  CancellationPolicyChangedException,
  EmptyCancellationPolicyUpdateException,
  InvalidCancellationPolicyRangeException,
} from '../exceptions/cancellation-policy.exceptions';
import { CANCELLATION_POLICY_REPOSITORY } from '../interfaces/cancellation-policy.repository.interface';
import type {
  CancellationPolicyPage,
  CancellationPolicyRepository,
  CancellationPolicySchedule,
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
    this.assertValues(input.cancelHours, input.penaltyPercent, input.cancellationAllowed, input.description);
    const isActive = input.isActive ?? true;
    if (isActive && await this.repository.findActiveByHotel(input.hotelId)) {
      throw new CancellationPolicyActiveConflictException(input.hotelId);
    }

    return this.repository.create({
      hotelId: input.hotelId,
      name,
      cancelHours: input.cancelHours,
      penaltyPercent: input.penaltyPercent,
      cancellationAllowed: input.cancellationAllowed ?? true,
      description: this.normalizeNullable(input.description),
      isActive,
    });
  }

  async getSchedule(hotelId: string): Promise<CancellationPolicySchedule> {
    const policy = await this.repository.findActiveByHotel(hotelId);
    const rules = policy ? [{
      id: policy.id,
      name: policy.name,
      cancelHours: policy.cancelHours,
      penaltyPercent: policy.penaltyPercent,
      cancellationAllowed: policy.cancellationAllowed,
      description: policy.description,
    }] : [];
    const version = createHash('sha256').update(JSON.stringify(rules)).digest('hex');
    const issue = policy ? null : 'Khách sạn chưa có chính sách hủy đang áp dụng.';
    return { hotelId, version, complete: issue === null, issue, rules };
  }

  async getCompleteScheduleForBooking(
    hotelId: string,
    expectedVersion: string,
  ): Promise<CancellationPolicySchedule> {
    const schedule = await this.getSchedule(hotelId);
    if (!schedule.complete) {
      throw new CancellationPolicyRequiredException(
        schedule.issue ?? 'Khách sạn cần thiết lập chính sách hủy trước khi nhận booking.',
      );
    }
    if (schedule.version !== expectedVersion) {
      throw new CancellationPolicyChangedException();
    }
    return schedule;
  }

  findPage(input: ListCancellationPoliciesRequest): Promise<CancellationPolicyPage> {
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
    if (this.isEmptyUpdate(input)) throw new EmptyCancellationPolicyUpdateException();
    const policy = await this.findById(id);
    await this.hotelsService.assertManagedBy(policy.hotelId, actor);

    const cancelHours = input.cancelHours ?? policy.cancelHours;
    const penaltyPercent = input.penaltyPercent ?? policy.penaltyPercent;
    const cancellationAllowed = input.cancellationAllowed ?? policy.cancellationAllowed;
    const description = input.description === undefined
      ? policy.description
      : this.normalizeNullable(input.description);
    this.assertValues(cancelHours, penaltyPercent, cancellationAllowed, description);

    if (input.name !== undefined) {
      const name = input.name.trim();
      const duplicate = await this.repository.findByHotelAndName(policy.hotelId, name);
      if (duplicate && duplicate.id !== policy.id) {
        throw new CancellationPolicyNameConflictException(policy.hotelId, name);
      }
      policy.name = name;
    }
    if (input.cancelHours !== undefined) policy.cancelHours = input.cancelHours;
    if (input.penaltyPercent !== undefined) policy.penaltyPercent = input.penaltyPercent;
    if (input.cancellationAllowed !== undefined) policy.cancellationAllowed = input.cancellationAllowed;
    if (input.description !== undefined) policy.description = description;
    if (input.isActive !== undefined && input.isActive && !policy.isActive) {
      const active = await this.repository.findActiveByHotel(policy.hotelId);
      if (active && active.id !== policy.id) {
        throw new CancellationPolicyActiveConflictException(policy.hotelId);
      }
    }
    if (input.isActive !== undefined) policy.isActive = input.isActive;

    return this.repository.save(policy);
  }

  async delete(id: string, actor: AuthorizationActor): Promise<void> {
    const policy = await this.findById(id);
    await this.hotelsService.assertManagedBy(policy.hotelId, actor);
    await this.repository.delete(policy);
  }

  private isEmptyUpdate(input: UpdateCancellationPolicyRequest): boolean {
    return [input.name, input.cancelHours, input.penaltyPercent,
      input.cancellationAllowed, input.description, input.isActive]
      .every((value) => value === undefined);
  }

  private assertValues(
    cancelHours: number,
    penaltyPercent: number,
    cancellationAllowed: boolean,
    description?: string | null,
  ): void {
    if (!Number.isInteger(cancelHours) || cancelHours < 0 || cancelHours > 87600 ||
      !Number.isFinite(penaltyPercent) || penaltyPercent < 0 || penaltyPercent > 100) {
      throw new InvalidCancellationPolicyRangeException('Số giờ hủy phải từ 0 đến 87.600; phí hủy phải từ 0% đến 100%.');
    }
    if (!cancellationAllowed && !description?.trim()) {
      throw new CancellationPolicyDescriptionRequiredException();
    }
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }
}
