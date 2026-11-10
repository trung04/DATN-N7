import {
  PlaceEntity,
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
  items: PlaceEntity[];
  total: number;
}

export interface CreatePlaceData {
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
  sourceType: PlaceSourceType;
  sourceProvider: string | null;
  externalProviderId: string | null;
  openingTime: string | null;
  sourceUrl: string | null;
  attributionText: string | null;
  licenseCode: string | null;
  lastRefreshedAt: Date | null;
}

export interface PlaceRepository {
  findById(id: string): Promise<PlaceEntity | null>;
  findByExternalProviderId(
    externalProviderId: string,
  ): Promise<PlaceEntity | null>;
  findPage(options: FindPlacesOptions): Promise<PlacePage>;
  create(data: CreatePlaceData): Promise<PlaceEntity>;
  save(place: PlaceEntity): Promise<PlaceEntity>;
  delete(place: PlaceEntity): Promise<void>;
}
