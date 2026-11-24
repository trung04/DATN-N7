import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { CancellationPolicyTier } from '../../entities/cancellation-policy.entity';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CancellationPolicyTierRequest implements CancellationPolicyTier {
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(87600)
  upToHours: number | null;

  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  feePercent: number | null;
}

export class CreateCancellationPolicyRequest {
  @IsUUID('4')
  hotelId: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ValidateIf((input: CreateCancellationPolicyRequest, value) =>
    input.tiers === undefined || value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(87600)
  cancelHours?: number;

  @ValidateIf((input: CreateCancellationPolicyRequest, value) =>
    input.tiers === undefined || value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  penaltyPercent?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => CancellationPolicyTierRequest)
  tiers?: CancellationPolicyTierRequest[];

  @IsOptional()
  @IsBoolean()
  cancellationAllowed?: boolean = true;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
