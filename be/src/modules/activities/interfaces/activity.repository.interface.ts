import { ActivityEntity } from '../entities/activity.entity';

export const ACTIVITY_REPOSITORY = Symbol('ACTIVITY_REPOSITORY');

export type ActivitySortField =
  'activityOrder' | 'name' | 'startTime' | 'endTime' | 'createdAt';

export interface FindActivitiesOptions {
  stopoverId: string;
  page: number;
  limit: number;
  sortBy: ActivitySortField;
  sortOrder: 'ASC' | 'DESC';
}

export interface ActivityPage {
  items: ActivityEntity[];
  total: number;
}

export interface CreateActivityData {
  stopoverId: string;
  activityOrder: number;
  name: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  estimatedCost: number | null;
  currency: string;
}

export interface ActivityRepository {
  findByIdAndStopoverId(
    id: string,
    stopoverId: string,
  ): Promise<ActivityEntity | null>;
  findByStopoverAndOrder(
    stopoverId: string,
    activityOrder: number,
  ): Promise<ActivityEntity | null>;
  findPage(options: FindActivitiesOptions): Promise<ActivityPage>;
  create(data: CreateActivityData): Promise<ActivityEntity>;
  save(activity: ActivityEntity): Promise<ActivityEntity>;
  delete(activity: ActivityEntity): Promise<void>;
}
