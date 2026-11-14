import { IsDateString, IsUUID, Matches } from 'class-validator';

export class CreateSettlementBatchRequest {
  @IsUUID('4')
  hotelId: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodEnd: string;
}
