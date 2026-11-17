import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class RoomGuestAllocationRequest {
  @IsUUID('4')
  roomId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  adultCount: number;

  @IsArray()
  @ArrayMaxSize(20)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(17, { each: true })
  childAges: number[] = [];
}
