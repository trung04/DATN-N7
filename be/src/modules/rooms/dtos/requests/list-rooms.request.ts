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
import { RoomOperationalStatus } from '../../entities/room.entity';
import type { RoomSortField } from '../../interfaces/room.repository.interface';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export enum RoomSortFieldQuery {
  ROOM_NUMBER = 'roomNumber',
  MAX_OCCUPANCY = 'maxOccupancy',
  PRICE_PER_NIGHT = 'pricePerNight',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export enum RoomSortOrderQuery {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListRoomsRequest {
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
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  hotelId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  roomType?: string;

  @IsOptional()
  @IsEnum(RoomOperationalStatus)
  operationalStatus?: RoomOperationalStatus;

  @IsEnum(RoomSortFieldQuery)
  sortBy: RoomSortField = RoomSortFieldQuery.CREATED_AT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(RoomSortOrderQuery)
  sortOrder: 'ASC' | 'DESC' = RoomSortOrderQuery.DESC;
}
