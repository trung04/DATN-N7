import { IsOptional } from 'class-validator';
import {
  IsDateString,
  IsUUID,
  Matches,
} from 'class-validator';

export class SearchRoomAvailabilityRequest {
  @IsOptional()
  @IsUUID('4')
  hotelId?: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkInDate must use YYYY-MM-DD format',
  })
  checkInDate: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkOutDate must use YYYY-MM-DD format',
  })
  checkOutDate: string;
}
