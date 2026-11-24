import { PlaceStatus } from '../../entities/place.entity';

export class PlaceResponse {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  countryCode: string | null;
  provinceCode: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  status: PlaceStatus;
  averageRating: number;
  externalProviderId: string | null;
  openingTime: string | null;
}

export class PlaceListResponse {
  data: PlaceResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
