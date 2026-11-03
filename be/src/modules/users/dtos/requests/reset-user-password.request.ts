import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetUserPasswordRequest {
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/[A-Za-z]/, { message: 'newPassword must contain a letter' })
  @Matches(/[0-9]/, { message: 'newPassword must contain a number' })
  newPassword: string;
}
