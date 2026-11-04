import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { AmenitySortField } from '../../interfaces/amenity.repository.interface';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export enum AmenitySortFieldQuery {
  CODE = 'code',
  NAME = 'name',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export enum SortOrderQuery {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListAmenitiesRequest {
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
  @MaxLength(100)
  search?: string;

  @IsEnum(AmenitySortFieldQuery)
  sortBy: AmenitySortField = AmenitySortFieldQuery.CREATED_AT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(SortOrderQuery)
  sortOrder: 'ASC' | 'DESC' = SortOrderQuery.DESC;
}
