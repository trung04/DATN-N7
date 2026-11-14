import {
  PlaceEntity,
  PlaceOpeningHours,
  PlaceSourceType,
  PlaceStatus,
} from '../entities/place.entity';

export const PLACE_REPOSITORY = Symbol('PLACE_REPOSITORY');

export type PlaceSortField = 'name' | 'averageRating' | 'status';

export interface FindPlacesOptions {
  page: number;
  limit: number;
  search?: string;
  status?: PlaceStatus;
  countryCode?: string;
  provinceCode?: string;
  minRating?: number;
  sortBy: PlaceSortField;
  sortOrder: 'ASC' | 'DESC';
}

export interface PlacePage {
  items: PlaceSummaryData[];
  total: number;
}

export interface PlaceCategoryData {
  code: string;
  name: string;
}

export interface PlaceImageData {
  imageUrl: string;
  imageOrder: number;
  altText: string | null;
  attributionText: string | null;
}

export interface PlacePriceData {
  minPrice: number;
  maxPrice: number;
  currency: string;
  pricingUnit: string;
  description: string | null;
}

export interface PlaceSummaryData {
  place: PlaceEntity;
  category: string | null;
  primaryImageUrl: string | null;
  price: PlacePriceData | null;
}

export interface PlaceDetailsData extends PlaceSummaryData {
  categories: PlaceCategoryData[];
  tags: string[];
  images: PlaceImageData[];
}

export interface PlaceCatalogOptions {
  categories: PlaceCategoryData[];
  topics: PlaceCategoryData[];
}

export interface PlaceCatalogWriteData {
  categoryCodes?: string[];
  topicCodes?: string[];
  imageUrl?: string | null;
  imageAltText?: string | null;
  referencePrice?: {
    minPrice: number;
    maxPrice: number;
    currency: string;
    pricingUnit: string;
    description?: string | null;
  } | null;
}

export interface CreatePlaceData {
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  provinceCode: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  status: PlaceStatus;
  averageRating: number;
  reviewCount: number;
  openingHours: PlaceOpeningHours | null;
  estimatedVisitDurationMinutes: number | null;
  amenities: string[];
  bestVisitTimes: string[];
  suitableFor: string[];
  contactPhone: string | null;
  contactWebsite: string | null;
  sourceType: PlaceSourceType;
  sourceProvider: string | null;
  externalProviderId: string | null;
  sourceUrl: string | null;
  attributionText: string | null;
  licenseCode: string | null;
  lastRefreshedAt: Date | null;
}

export interface PlaceRepository {
  findById(id: string): Promise<PlaceEntity | null>;
  findDetailsById(id: string): Promise<PlaceDetailsData | null>;
  findByExternalProviderId(
    externalProviderId: string,
  ): Promise<PlaceEntity | null>;
  findPage(options: FindPlacesOptions): Promise<PlacePage>;
  findCatalogOptions(): Promise<PlaceCatalogOptions>;
  create(data: CreatePlaceData, catalog: PlaceCatalogWriteData): Promise<PlaceEntity>;
  save(place: PlaceEntity, catalog: PlaceCatalogWriteData): Promise<PlaceEntity>;
  delete(place: PlaceEntity): Promise<void>;
}
