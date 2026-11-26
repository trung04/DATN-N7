import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RecommendTravelRequest {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  query: string;

  @IsBoolean()
  usePreferences = false;
}

export class PlanTravelRequest {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;

  @IsInt()
  @Min(1)
  @Max(100)
  adults: number;

  @IsInt()
  @Min(0)
  @Max(99)
  children: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999_999.99)
  budget: number;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  interests: string[];

  @Transform(trim)
  @IsString()
  @MaxLength(120)
  style: string;

  @Transform(trim)
  @IsString()
  @MaxLength(1800)
  note: string;
}
