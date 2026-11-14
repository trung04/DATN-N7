import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class SaveTravelPreferenceRequest {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  interestCodes: string[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  budget: number;

  @Transform(trim)
  @IsString()
  @MaxLength(50)
  style: string;

  @Transform(trim)
  @IsString()
  @MaxLength(50)
  transport: string;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
      : value,
  )
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  destinations: string[];
}
