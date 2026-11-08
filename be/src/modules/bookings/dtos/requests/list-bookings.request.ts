import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BookingStatus,
  PaymentStatus,
  RefundStatus,
  SettlementStatus,
} from '../../entities/booking.entity';
import type { BookingSortField } from '../../interfaces/booking.repository.interface';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export enum BookingSortFieldQuery {
  CREATED_AT = 'createdAt',
  BOOKING_CODE = 'bookingCode',
  TOTAL_AMOUNT = 'totalAmount',
  AMOUNT = 'amount',
}

export enum BookingSortOrderQuery {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListBookingsRequest {
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
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  hotelId?: string;

  @IsOptional()
  @IsUUID('4')
  touristId?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  bookingStatus?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(SettlementStatus)
  settlementStatus?: SettlementStatus;

  @IsOptional()
  @IsEnum(RefundStatus)
  refundStatus?: RefundStatus;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsEnum(BookingSortFieldQuery)
  sortBy: BookingSortField = BookingSortFieldQuery.CREATED_AT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(BookingSortOrderQuery)
  sortOrder: 'ASC' | 'DESC' = BookingSortOrderQuery.DESC;
}
