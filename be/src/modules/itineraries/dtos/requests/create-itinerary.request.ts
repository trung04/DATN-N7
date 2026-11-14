import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ItineraryStatus } from '../../entities/itinerary.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateItineraryRequest {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  destinationCity: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;

  @IsTimeZone()
  timezone = 'Asia/Ho_Chi_Minh';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  adultCount = 1;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  childCount = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999_999.99)
  budget?: number;

  @Transform(uppercase)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter code' })
  currency = 'VND';

  @IsEnum(ItineraryStatus)
  status: ItineraryStatus = ItineraryStatus.DRAFT;
}
