import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ActivityEntity } from '../entities/activity.entity';
import { ActivityOrderConflictException } from '../exceptions/activity.exceptions';
import type {
  ActivityPage,
  ActivityRepository,
  CreateActivityData,
  FindActivitiesOptions,
} from '../interfaces/activity.repository.interface';

@Injectable()
export class TypeOrmActivityRepository implements ActivityRepository {
  constructor(
    @InjectRepository(ActivityEntity)
    private readonly repository: Repository<ActivityEntity>,
  ) {}

  findByIdAndStopoverId(
    id: string,
    stopoverId: string,
  ): Promise<ActivityEntity | null> {
    return this.repository.findOneBy({ id, stopoverId });
  }

  findByStopoverAndOrder(
    stopoverId: string,
    activityOrder: number,
  ): Promise<ActivityEntity | null> {
    return this.repository.findOneBy({ stopoverId, activityOrder });
  }

  async findPage(options: FindActivitiesOptions): Promise<ActivityPage> {
    const sortColumns: Record<FindActivitiesOptions['sortBy'], string> = {
      activityOrder: 'activity.activityOrder',
      name: 'activity.name',
      startTime: 'activity.startTime',
      endTime: 'activity.endTime',
      createdAt: 'activity.createdAt',
    };
    const [items, total] = await this.repository
      .createQueryBuilder('activity')
      .where('activity.stopoverId = :stopoverId', {
        stopoverId: options.stopoverId,
      })
      .orderBy(sortColumns[options.sortBy], options.sortOrder)
      .addOrderBy('activity.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
    return { items, total };
  }

  async create(data: CreateActivityData): Promise<ActivityEntity> {
    try {
      return await this.repository.save(this.repository.create(data));
    } catch (error) {
      this.rethrowOrderConflict(error, data.stopoverId, data.activityOrder);
    }
  }

  async save(activity: ActivityEntity): Promise<ActivityEntity> {
    try {
      return await this.repository.save(activity);
    } catch (error) {
      this.rethrowOrderConflict(
        error,
        activity.stopoverId,
        activity.activityOrder,
      );
    }
  }

  async delete(activity: ActivityEntity): Promise<void> {
    await this.repository.softRemove(activity);
  }

  private rethrowOrderConflict(
    error: unknown,
    stopoverId: string,
    activityOrder: number,
  ): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      throw new ActivityOrderConflictException(stopoverId, activityOrder);
    }
    throw error;
  }
}
