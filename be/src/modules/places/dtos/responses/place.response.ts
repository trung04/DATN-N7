import {
  PlaceSourceType,
  PlaceStatus,
} from '../../entities/place.entity';

export class PlaceOpeningPeriodResponse {
  start: string;
  end: string;
}

export class PlaceWeeklyOpeningHoursResponse {
  monday?: PlaceOpeningPeriodResponse[];
  tuesday?: PlaceOpeningPeriodResponse[];
  wednesday?: PlaceOpeningPeriodResponse[];
  thursday?: PlaceOpeningPeriodResponse[];
  friday?: PlaceOpeningPeriodResponse[];
  saturday?: PlaceOpeningPeriodResponse[];
  sunday?: PlaceOpeningPeriodResponse[];
}

export class PlaceOpeningHoursResponse {
  display?: string;
  weekly?: PlaceWeeklyOpeningHoursResponse;
}

export class PlaceCategoryResponse {
  code: string;
  name: string;
}

export class PlaceImageResponse {
  imageUrl: string;
  isPrimary: boolean;
  altText: string | null;
  attributionText: string | null;
}

export class PlacePriceResponse {
  isFree: boolean;
  minPrice: number;
  maxPrice: number;
  currency: string;
  pricingUnit: string;
  description: string | null;
}

export class PlaceContactResponse {
  phone: string | null;
  website: string | null;
}

export class PlaceSourceResponse {
  type: PlaceSourceType;
  provider: string | null;
  sourceUrl: string | null;
  attributionText: string | null;
  licenseCode: string | null;
  lastRefreshedAt: string | null;
}

export class PlaceSummaryResponse {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: PlaceStatus;
  averageRating: number;
  reviewCount: number;
  estimatedVisitDurationMinutes: number | null;
  primaryImageUrl: string | null;
  price: PlacePriceResponse | null;
}

export class PlaceResponse extends PlaceSummaryResponse {
  description: string | null;
  countryCode: string | null;
  provinceCode: string | null;
  timezone: string | null;
  categories: PlaceCategoryResponse[];
  tags: string[];
  amenities: string[];
  images: PlaceImageResponse[];
  openingHours: PlaceOpeningHoursResponse | null;
  bestVisitTimes: string[];
  suitableFor: string[];
  contact: PlaceContactResponse;
  source: PlaceSourceResponse;
  catalogVersion: number;
}

export class PlaceListResponse {
  data: PlaceSummaryResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
