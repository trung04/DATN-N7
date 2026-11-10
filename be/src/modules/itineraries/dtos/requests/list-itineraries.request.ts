import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ItineraryStatus } from '../../entities/itinerary.entity';
import type { ItinerarySortField } from '../../interfaces/itinerary.repository.interface';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export enum ItinerarySortFieldQuery {
  NAME = 'name',
  START_DATE = 'startDate',
  END_DATE = 'endDate',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export enum ItinerarySortOrderQuery {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListItinerariesRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  touristUserId?: string;

  @IsOptional()
  @IsEnum(ItineraryStatus)
  status?: ItineraryStatus;

  @IsEnum(ItinerarySortFieldQuery)
  sortBy: ItinerarySortField = ItinerarySortFieldQuery.UPDATED_AT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(ItinerarySortOrderQuery)
  sortOrder: 'ASC' | 'DESC' = ItinerarySortOrderQuery.DESC;
}
