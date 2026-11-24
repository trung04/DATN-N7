import { Inject, Injectable } from '@nestjs/common';
import type { StopoverEntity } from '../../stopovers/entities/stopover.entity';
import { StopoversService } from '../../stopovers/services/stopovers.service';
import { CreateActivityRequest } from '../dtos/requests/create-activity.request';
import { ListActivitiesRequest } from '../dtos/requests/list-activities.request';
import { UpdateActivityRequest } from '../dtos/requests/update-activity.request';
import { ActivityEntity } from '../entities/activity.entity';
import {
  ActivityNotFoundException,
  ActivityOrderConflictException,
  ActivityOutsideStopoverException,
  ActivityScheduleConflictException,
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
    const stopover = await this.stopoversService.findByIdForTourist(
      stopoverId,
      touristUserId,
    );
    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    this.assertTimeRange(startTime, endTime);
    const existing = await this.repository.findByStopoverId(stopoverId);
    this.assertScheduleAvailable(stopover, existing, startTime, endTime);
    if (
      existing.some(
        (activity) => activity.activityOrder === input.activityOrder,
      )
    ) {
      throw new ActivityOrderConflictException(stopoverId, input.activityOrder);
    }
    return this.repository.create({
      stopoverId,
      activityOrder: input.activityOrder,
      name: input.name.trim(),
      description: this.normalizeNullable(input.description),
      startTime,
      endTime,
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
    const stopover = await this.stopoversService.findByIdForTourist(
      stopoverId,
      touristUserId,
    );
    const activity = await this.repository.findByIdAndStopoverId(
      id,
      stopoverId,
    );
    if (!activity) throw new ActivityNotFoundException(id);
    const activityOrder = input.activityOrder ?? activity.activityOrder;
    const startTime = input.startTime
      ? new Date(input.startTime)
      : activity.startTime;
    const endTime = input.endTime ? new Date(input.endTime) : activity.endTime;
    this.assertTimeRange(startTime, endTime);
    const existing = (
      await this.repository.findByStopoverId(stopoverId)
    ).filter((item) => item.id !== id);
    this.assertScheduleAvailable(stopover, existing, startTime, endTime);

    if (activityOrder !== activity.activityOrder) {
      const duplicate = existing.find(
        (item) => item.activityOrder === activityOrder,
      );
      if (duplicate && duplicate.id !== id) {
        throw new ActivityOrderConflictException(stopoverId, activityOrder);
      }
    }
    activity.activityOrder = activityOrder;
    activity.startTime = startTime;
    activity.endTime = endTime;
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

  async delete(
    stopoverId: string,
    id: string,
    touristUserId: string,
  ): Promise<void> {
    await this.repository.delete(
      await this.findById(stopoverId, id, touristUserId),
    );
  }

  private assertTimeRange(startTime: Date, endTime: Date): void {
    if (endTime <= startTime) {
      throw new InvalidActivityTimeRangeException();
    }
  }

  private assertScheduleAvailable(
    stopover: StopoverEntity,
    existing: ActivityEntity[],
    startTime: Date,
    endTime: Date,
  ): void {
    if (startTime < stopover.arrivalTime || endTime > stopover.departureTime) {
      throw new ActivityOutsideStopoverException();
    }
    const overlap = existing.find(
      (activity) =>
        startTime < activity.endTime && activity.startTime < endTime,
    );
    if (overlap) throw new ActivityScheduleConflictException(overlap.id);
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }
}
