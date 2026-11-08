import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const lowercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginRequest {
  @Transform(lowercase)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
