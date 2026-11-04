import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RoomOperationalStatus } from '../../entities/room.entity';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateRoomRequest {
  @IsUUID('4')
  hotelId: string;

  @Transform(uppercase)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  roomNumber: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxOccupancy: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  pricePerNight: number;

  @Transform(uppercase)
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter code' })
  currency = 'VND';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsEnum(RoomOperationalStatus)
  operationalStatus: RoomOperationalStatus = RoomOperationalStatus.AVAILABLE;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  roomType: string;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  amenityIds: string[] = [];
}
