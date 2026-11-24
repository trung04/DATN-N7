import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { HotelsService } from '../../hotels/services/hotels.service';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { CreateCancellationPolicyRequest } from '../dtos/requests/create-cancellation-policy.request';
import { ListCancellationPoliciesRequest } from '../dtos/requests/list-cancellation-policies.request';
import { UpdateCancellationPolicyRequest } from '../dtos/requests/update-cancellation-policy.request';
import { CancellationPolicyEntity } from '../entities/cancellation-policy.entity';
import type { CancellationPolicyTier } from '../entities/cancellation-policy.entity';
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
    const terms = input.tiers === undefined
      ? {
        cancelHours: input.cancelHours ?? NaN,
        penaltyPercent: input.penaltyPercent ?? NaN,
        cancellationAllowed: input.cancellationAllowed ?? true,
      }
      : this.validateTiers(input.tiers);
    if (input.tiers === undefined) {
      this.assertValues(terms.cancelHours, terms.penaltyPercent, terms.cancellationAllowed, input.description);
    }
    const isActive = input.isActive ?? true;
    if (isActive && await this.repository.findActiveByHotel(input.hotelId)) {
      throw new CancellationPolicyActiveConflictException(input.hotelId);
    }

    return this.repository.create({
      hotelId: input.hotelId,
      name,
      ...terms,
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
      ...(policy.tiers ? { tiers: policy.tiers } : {}),
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
    if (input.tiers !== undefined) {
      Object.assign(policy, this.validateTiers(input.tiers));
    } else if (!policy.tiers) {
      this.assertValues(cancelHours, penaltyPercent, cancellationAllowed, description);
      policy.cancelHours = cancelHours;
      policy.penaltyPercent = penaltyPercent;
      policy.cancellationAllowed = cancellationAllowed;
    } else if ([input.cancelHours, input.penaltyPercent, input.cancellationAllowed].some(value => value !== undefined)) {
      throw new InvalidCancellationPolicyRangeException('Hãy cập nhật điều khoản bằng danh sách mốc phí hủy.');
    }

    if (input.name !== undefined) {
      const name = input.name.trim();
      const duplicate = await this.repository.findByHotelAndName(policy.hotelId, name);
      if (duplicate && duplicate.id !== policy.id) {
        throw new CancellationPolicyNameConflictException(policy.hotelId, name);
      }
      policy.name = name;
    }
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
      input.cancellationAllowed, input.description, input.isActive, input.tiers]
      .every((value) => value === undefined);
  }

  private validateTiers(tiers: CancellationPolicyTier[]) {
    if (!Array.isArray(tiers) || tiers.at(-1)?.upToHours !== null) {
      throw new InvalidCancellationPolicyRangeException('Cần có điều khoản sau mốc cuối.');
    }
    let previous = -1;
    let cancelHours = 0;
    let stillFree = true;
    for (const [index, tier] of tiers.entries()) {
      const last = index === tiers.length - 1;
      const { upToHours, feePercent } = tier;
      if (!last && (upToHours === null || !Number.isInteger(upToHours) ||
        upToHours <= previous || upToHours > 87600)) {
        throw new InvalidCancellationPolicyRangeException('Mốc giờ phải tăng dần, không trùng nhau và nằm trong khoảng 0 đến 87.600.');
      }
      if (feePercent === null ? !last : !Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) {
        throw new InvalidCancellationPolicyRangeException('Phí hủy phải từ 0% đến 100%. Chỉ điều khoản cuối có thể không cho hủy.');
      }
      if (upToHours !== null) {
        previous = upToHours;
        stillFree = stillFree && feePercent === 0;
        if (stillFree) cancelHours = upToHours;
      }
    }
    return {
      tiers: tiers.map(({ upToHours, feePercent }) => ({ upToHours, feePercent })),
      cancelHours,
      penaltyPercent: tiers.at(-1)?.feePercent ?? 100,
      cancellationAllowed: tiers.some(tier => tier.feePercent !== null),
    };
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
