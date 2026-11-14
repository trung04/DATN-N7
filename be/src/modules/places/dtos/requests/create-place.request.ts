import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  ValidateNested,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PlaceStatus } from '../../entities/place.entity';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreatePlaceRequest {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @Transform(uppercase)
  @Matches(/^[A-Z]{2}$/, { message: 'countryCode must be an ISO alpha-2 code' })
  countryCode?: string | null;

  @IsOptional()
  @Transform(uppercase)
  @Matches(/^[A-Z0-9-]{1,20}$/, {
    message: 'provinceCode contains invalid characters',
  })
  provinceCode?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsTimeZone()
  @MaxLength(100)
  timezone?: string | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsEnum(PlaceStatus)
  status: PlaceStatus = PlaceStatus.ACTIVE;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  externalProviderId?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  openingTime?: string | null;

  @IsOptional()
  @Transform(uppercase)
  @Matches(/^[A-Z0-9_-]{1,50}$/)
  categoryCode?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @Matches(/^[A-Z0-9_-]{1,50}$/, { each: true })
  topicCodes?: string[];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^(https?:\/\/|\/images\/)[^\s]+$/i, {
    message: 'imageUrl must be an http(s) URL or an /images/ asset path',
  })
  imageUrl?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  imageAltText?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlaceReferencePriceRequest)
  referencePrice?: PlaceReferencePriceRequest | null;
}

export class PlaceReferencePriceRequest {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice: number;

  @IsOptional()
  @Transform(uppercase)
  @Matches(/^[A-Z]{3}$/)
  currency = 'VND';

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  pricingUnit = 'người';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
