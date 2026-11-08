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
import { HotelStatus } from '../../entities/hotel.entity';
import type { HotelSortField } from '../../interfaces/hotel.repository.interface';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export enum HotelSortFieldQuery {
  CREATED_AT = 'createdAt',
  NAME = 'name',
  STATUS = 'status',
}

export enum HotelSortOrderQuery {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListHotelsRequest {
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
  ownerUserId?: string;

  @IsOptional()
  @IsUUID('4')
  placeId?: string;

  @IsOptional()
  @IsEnum(HotelStatus)
  status?: HotelStatus;

  @IsEnum(HotelSortFieldQuery)
  sortBy: HotelSortField = HotelSortFieldQuery.CREATED_AT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(HotelSortOrderQuery)
  sortOrder: 'ASC' | 'DESC' = HotelSortOrderQuery.DESC;
}
