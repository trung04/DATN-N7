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
import { PlaceReferencePriceRequest } from './create-place.request';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class UpdatePlaceRequest {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsEnum(PlaceStatus)
  status?: PlaceStatus;

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
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
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
