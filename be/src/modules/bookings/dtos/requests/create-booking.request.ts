import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateBookingRequest {
  @IsString()
  @Length(64, 64)
  @Matches(/^[a-f0-9]{64}$/)
  cancellationPolicyVersion: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roomIds: string[];

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkInDate must use YYYY-MM-DD format',
  })
  checkInDate: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkOutDate must use YYYY-MM-DD format',
  })
  checkOutDate: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  adultCount: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  childCount = 0;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  guestName: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  guestEmail: string;

  @Transform(trim)
  @Matches(/^\+?[0-9][0-9 .()-]{6,28}$/, {
    message: 'guestPhone must be a valid phone number',
  })
  guestPhone: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  specialRequests?: string | null;

}
