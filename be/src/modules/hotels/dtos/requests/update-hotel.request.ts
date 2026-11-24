import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateHotelRequest } from './create-hotel.request';

export class UpdateHotelRequest extends PartialType(
  OmitType(CreateHotelRequest, ['ownerUserId'] as const),
) {}
