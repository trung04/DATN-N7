import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PlaceStatus } from '../../entities/place.entity';
import type { PlaceSortField } from '../../interfaces/place.repository.interface';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export enum PlaceSortFieldQuery {
  NAME = 'name',
  AVERAGE_RATING = 'averageRating',
  STATUS = 'status',
}

export enum PlaceSortOrderQuery {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListPlacesRequest {
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
  @IsEnum(PlaceStatus)
  status?: PlaceStatus;

  @IsOptional()
  @Transform(uppercase)
  @Matches(/^[A-Z]{2}$/, { message: 'countryCode must be an ISO alpha-2 code' })
  countryCode?: string;

  @IsOptional()
  @Transform(uppercase)
  @Matches(/^[A-Z0-9-]{1,20}$/)
  provinceCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsEnum(PlaceSortFieldQuery)
  sortBy: PlaceSortField = PlaceSortFieldQuery.NAME;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(PlaceSortOrderQuery)
  sortOrder: 'ASC' | 'DESC' = PlaceSortOrderQuery.ASC;
}
