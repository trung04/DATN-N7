import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RefundBookingRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9_999_999_999)
  refundAmount: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  refundReason: string;
}
