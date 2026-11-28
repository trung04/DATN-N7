import { OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { RegisterRequest } from './register.request';

export class RegisterHotelOwnerRequest extends OmitType(RegisterRequest, ['displayName'] as const) {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  displayName: string;
}
