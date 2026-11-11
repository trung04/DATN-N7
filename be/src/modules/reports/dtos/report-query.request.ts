import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum ReportGroupBy {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class ReportQueryRequest {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional()
  @IsUUID('4')
  hotelId?: string;

  @IsOptional()
  @IsEnum(ReportGroupBy)
  groupBy = ReportGroupBy.DAY;
}
