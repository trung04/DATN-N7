import { IsString, Matches } from 'class-validator';

export class TwoFactorCodeRequest {
  @IsString()
  @Matches(/^(?:\d{6}|[A-Za-z0-9]{4}-[A-Za-z0-9]{4})$/)
  code: string;
}
