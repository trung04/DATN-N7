import { IsInt, Min } from 'class-validator';

export class RequestSettlementPayout {
  @IsInt()
  @Min(1)
  revision: number;
}
