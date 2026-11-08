import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export enum HotelReviewCommand {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  SUSPEND = 'SUSPEND',
  REACTIVATE = 'REACTIVATE',
}

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ReviewHotelRequest {
  @IsUUID('4')
  reviewerUserId: string;

  @IsEnum(HotelReviewCommand)
  action: HotelReviewCommand;

  @ValidateIf(
    (input: ReviewHotelRequest) =>
      input.action === HotelReviewCommand.REJECT ||
      input.action === HotelReviewCommand.SUSPEND,
  )
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason?: string;
}
