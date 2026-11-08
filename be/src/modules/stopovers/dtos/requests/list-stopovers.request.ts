import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, Max, Min } from 'class-validator';
import type { StopoverSortField } from '../../interfaces/stopover.repository.interface';

export enum StopoverSortFieldQuery {
  STOP_ORDER = 'stopOrder',
  ARRIVAL_TIME = 'arrivalTime',
  DEPARTURE_TIME = 'departureTime',
  CREATED_AT = 'createdAt',
}

export enum StopoverSortOrderQuery {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListStopoversRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsEnum(StopoverSortFieldQuery)
  sortBy: StopoverSortField = StopoverSortFieldQuery.STOP_ORDER;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(StopoverSortOrderQuery)
  sortOrder: 'ASC' | 'DESC' = StopoverSortOrderQuery.ASC;
}
