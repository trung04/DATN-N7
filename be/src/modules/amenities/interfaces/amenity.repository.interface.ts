import { AmenityEntity } from '../entities/amenity.entity';

export const AMENITY_REPOSITORY = Symbol('AMENITY_REPOSITORY');

export type AmenitySortField = 'code' | 'name' | 'createdAt' | 'updatedAt';

export interface FindAmenitiesOptions {
  page: number;
  limit: number;
  search?: string;
  sortBy: AmenitySortField;
  sortOrder: 'ASC' | 'DESC';
}

export interface AmenityPage {
  items: AmenityEntity[];
  total: number;
}

export interface CreateAmenityData {
  code: string;
  name: string;
}

export interface AmenityRepository {
  findById(id: string): Promise<AmenityEntity | null>;
  findByCode(code: string): Promise<AmenityEntity | null>;
  findPage(options: FindAmenitiesOptions): Promise<AmenityPage>;
  create(data: CreateAmenityData): Promise<AmenityEntity>;
  save(amenity: AmenityEntity): Promise<AmenityEntity>;
  delete(amenity: AmenityEntity): Promise<void>;
}
