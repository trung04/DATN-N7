import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export enum ReviewModerationAction {
  APPROVE = 'APPROVE',
  HIDE = 'HIDE',
  RESTORE = 'RESTORE',
}

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ModerateReviewRequest {
  @IsEnum(ReviewModerationAction)
  action: ReviewModerationAction;

  @ValidateIf((input: ModerateReviewRequest) => input.action === ReviewModerationAction.HIDE)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  reason?: string;

  @IsOptional()
  @ValidateIf((_input: ModerateReviewRequest, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  note?: string;
}
