import { Transform, Type } from 'class-transformer';
import {
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

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateHotelRequest {
  @IsUUID('4')
  ownerUserId: string;

  @IsOptional()
  @IsUUID('4')
  placeId?: string | null;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  taxCode: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @Transform(trim)
  @Matches(/^\+?[0-9][0-9 .()-]{6,28}$/, {
    message: 'phoneNumber must be a valid phone number',
  })
  phoneNumber: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  starRating?: number | null;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'checkInTime must use HH:mm format',
  })
  checkInTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'checkOutTime must use HH:mm format',
  })
  checkOutTime: string;
}
