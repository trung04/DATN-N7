import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class UpsertRoomGuestPolicyRequest {
  @IsUUID('4')
  hotelId: string;

  @Transform(trim)
  @IsString()
  @Length(1, 60)
  roomType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxAdults: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxChildren: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(11)
  freeChildMaxAge: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  childSurchargePerNight: number;
}

export class ListRoomGuestPoliciesRequest {
  @IsOptional()
  @IsUUID('4')
  hotelId?: string;

  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((item) => item.trim()).filter(Boolean)
      : value,
  )
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  hotelIds?: string[];
}

export class RoomGuestPolicyResponse {
  id: string;
  hotelId: string;
  roomType: string;
  maxAdults: number;
  maxChildren: number;
  adultAgeFrom: number;
  freeChildMaxAge: number;
  childSurchargePerNight: number;
  createdAt: string;
  updatedAt: string;
}
