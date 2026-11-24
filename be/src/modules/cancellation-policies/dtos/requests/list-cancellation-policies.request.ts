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
import type { CancellationPolicySortField } from '../../interfaces/cancellation-policy.repository.interface';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export enum CancellationPolicySortFieldQuery {
  NAME = 'name',
  CANCELLATION_WINDOW = 'cancellationWindow',
  CANCELLATION_FEE_RATE = 'cancellationFeeRate',
}

export enum CancellationPolicySortOrderQuery {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListCancellationPoliciesRequest {
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
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  hotelId?: string;

  @IsEnum(CancellationPolicySortFieldQuery)
  sortBy: CancellationPolicySortField = CancellationPolicySortFieldQuery.NAME;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(CancellationPolicySortOrderQuery)
  sortOrder: 'ASC' | 'DESC' = CancellationPolicySortOrderQuery.ASC;
}
