import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserGender, UserStatus } from '../../entities/user.entity';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const lowercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateUserRequest {
  @Transform(lowercase)
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/, {
    message: 'username contains invalid characters',
  })
  username: string;

  @Transform(lowercase)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/[A-Za-z]/, { message: 'password must contain a letter' })
  @Matches(/[0-9]/, { message: 'password must contain a number' })
  password: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  displayName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'phoneNumber has invalid format' })
  phoneNumber?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateOfBirth must use YYYY-MM-DD format',
  })
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsEnum(UserStatus)
  status: UserStatus = UserStatus.ACTIVE;
}
