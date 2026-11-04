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
import type { HotelOwnerSortField } from '../../interfaces/hotel-owner.repository.interface';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export enum HotelOwnerSortFieldQuery {
  USER_ID = 'userId',
  BANK_NAME = 'bankName',
  BANK_ACCOUNT_HOLDER = 'bankAccountHolder',
}

export enum HotelOwnerSortOrderQuery {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListHotelOwnersRequest {
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
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @IsEnum(HotelOwnerSortFieldQuery)
  sortBy: HotelOwnerSortField = HotelOwnerSortFieldQuery.USER_ID;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(HotelOwnerSortOrderQuery)
  sortOrder: 'ASC' | 'DESC' = HotelOwnerSortOrderQuery.ASC;
}
