import { Inject, Injectable } from '@nestjs/common';
import { StopoversService } from '../../stopovers/services/stopovers.service';
import { CreateActivityRequest } from '../dtos/requests/create-activity.request';
import { ListActivitiesRequest } from '../dtos/requests/list-activities.request';
import { UpdateActivityRequest } from '../dtos/requests/update-activity.request';
import { ActivityEntity } from '../entities/activity.entity';
import {
  ActivityNotFoundException,
  ActivityOrderConflictException,
  EmptyActivityUpdateException,
  InvalidActivityTimeRangeException,
} from '../exceptions/activity.exceptions';
import { ACTIVITY_REPOSITORY } from '../interfaces/activity.repository.interface';
import type {
  ActivityPage,
  ActivityRepository,
} from '../interfaces/activity.repository.interface';

@Injectable()
export class ActivitiesService {
  constructor(
    @Inject(ACTIVITY_REPOSITORY)
    private readonly repository: ActivityRepository,
    private readonly stopoversService: StopoversService,
  ) {}

  async create(
    stopoverId: string,
    input: CreateActivityRequest,
    touristUserId: string,
  ): Promise<ActivityEntity> {
    await this.stopoversService.findByIdForTourist(stopoverId, touristUserId);
    this.assertTimeRange(input.startTime, input.endTime);
    if (
      await this.repository.findByStopoverAndOrder(
        stopoverId,
        input.activityOrder,
      )
    ) {
      throw new ActivityOrderConflictException(stopoverId, input.activityOrder);
    }
    return this.repository.create({
      stopoverId,
      activityOrder: input.activityOrder,
      name: input.name.trim(),
      description: this.normalizeNullable(input.description),
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
      estimatedCost: input.estimatedCost ?? null,
      currency: input.currency.trim().toUpperCase(),
    });
  }

  async findPage(
    stopoverId: string,
    input: ListActivitiesRequest,
    touristUserId: string,
  ): Promise<ActivityPage> {
    await this.stopoversService.findByIdForTourist(stopoverId, touristUserId);
    return this.repository.findPage({
      stopoverId,
      page: input.page,
      limit: input.limit,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
  }

  async findById(
    stopoverId: string,
    id: string,
    touristUserId: string,
  ): Promise<ActivityEntity> {
    await this.stopoversService.findByIdForTourist(stopoverId, touristUserId);
    const activity = await this.repository.findByIdAndStopoverId(
      id,
      stopoverId,
    );
    if (!activity) throw new ActivityNotFoundException(id);
    return activity;
  }

  async update(
    stopoverId: string,
    id: string,
    input: UpdateActivityRequest,
    touristUserId: string,
  ): Promise<ActivityEntity> {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new EmptyActivityUpdateException();
    }
    const activity = await this.findById(stopoverId, id, touristUserId);
    const activityOrder = input.activityOrder ?? activity.activityOrder;
    const startTime = input.startTime ?? activity.startTime.toISOString();
    const endTime = input.endTime ?? activity.endTime.toISOString();
    this.assertTimeRange(startTime, endTime);

    if (activityOrder !== activity.activityOrder) {
      const duplicate = await this.repository.findByStopoverAndOrder(
        stopoverId,
        activityOrder,
      );
      if (duplicate && duplicate.id !== id) {
        throw new ActivityOrderConflictException(stopoverId, activityOrder);
      }
    }
    activity.activityOrder = activityOrder;
    activity.startTime = new Date(startTime);
    activity.endTime = new Date(endTime);
    if (input.name !== undefined) activity.name = input.name.trim();
    if (input.description !== undefined) {
      activity.description = this.normalizeNullable(input.description);
    }
    if (input.estimatedCost !== undefined) {
      activity.estimatedCost = input.estimatedCost;
    }
    if (input.currency !== undefined) {
      activity.currency = input.currency.trim().toUpperCase();
    }
    return this.repository.save(activity);
  }

  async delete(stopoverId: string, id: string, touristUserId: string): Promise<void> {
    await this.repository.delete(await this.findById(stopoverId, id, touristUserId));
  }

  private assertTimeRange(startTime: string, endTime: string): void {
    if (new Date(endTime) <= new Date(startTime)) {
      throw new InvalidActivityTimeRangeException();
    }
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }
}
