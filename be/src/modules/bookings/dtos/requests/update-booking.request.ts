import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BookingStatus } from '../../entities/booking.entity';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateBookingRequest {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  adultCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  childCount?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  guestName?: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  guestEmail?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\+?[0-9][0-9 .()-]{6,28}$/, {
    message: 'guestPhone must be a valid phone number',
  })
  guestPhone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  specialRequests?: string | null;

  @IsOptional()
  @IsEnum(BookingStatus)
  bookingStatus?: BookingStatus;

  @IsOptional()
  @IsUUID('4')
  cancellationPolicyId?: string | null;
}
