import { PickType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ListPlacesRequest } from '../../../places/dtos/requests/list-places.request';

export class SearchPlacesRequest extends PickType(ListPlacesRequest, [
  'page',
  'limit',
  'search',
  'city',
  'categoryCode',
  'sortBy',
  'sortOrder',
] as const) {
  @IsOptional()
  @IsBoolean()
  relevance?: boolean;
}
