import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class GoogleStartRequest {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(/^\/(?!\/)/, { message: 'returnTo must be a local path' })
  returnTo?: string;
}
