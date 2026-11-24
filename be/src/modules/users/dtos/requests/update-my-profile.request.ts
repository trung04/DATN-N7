import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserGender } from '../../entities/user.entity';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateMyProfileRequest {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  displayName?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'phoneNumber has invalid format' })
  phoneNumber?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateOfBirth must use YYYY-MM-DD format',
  })
  dateOfBirth?: string | null;

  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender | null;
}
