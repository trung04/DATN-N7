import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, Max, Min } from 'class-validator';
import type { ActivitySortField } from '../../interfaces/activity.repository.interface';

export enum ActivitySortFieldQuery {
  ACTIVITY_ORDER = 'activityOrder',
  NAME = 'name',
  START_TIME = 'startTime',
  END_TIME = 'endTime',
  CREATED_AT = 'createdAt',
}

export enum ActivitySortOrderQuery {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListActivitiesRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsEnum(ActivitySortFieldQuery)
  sortBy: ActivitySortField = ActivitySortFieldQuery.ACTIVITY_ORDER;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(ActivitySortOrderQuery)
  sortOrder: 'ASC' | 'DESC' = ActivitySortOrderQuery.ASC;
}
