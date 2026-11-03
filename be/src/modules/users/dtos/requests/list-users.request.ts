import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UserGender, UserStatus } from '../../entities/user.entity';
import type { UserSortField } from '../../interfaces/user.repository.interface';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export enum UserSortFieldQuery {
  USERNAME = 'username',
  EMAIL = 'email',
  DISPLAY_NAME = 'displayName',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export enum UserSortOrderQuery {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListUsersRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isEmailVerified?: boolean;

  @IsEnum(UserSortFieldQuery)
  sortBy: UserSortField = UserSortFieldQuery.CREATED_AT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(UserSortOrderQuery)
  sortOrder: 'ASC' | 'DESC' = UserSortOrderQuery.DESC;
}
