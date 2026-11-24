import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateStopoverRequest {
  @IsOptional()
  @IsUUID('4')
  placeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  stopOrder?: number;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'arrivalTime must include a UTC offset',
  })
  arrivalTime?: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'departureTime must include a UTC offset',
  })
  departureTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}
