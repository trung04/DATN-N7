import type { HotelImageEntity } from '../entities/hotel-image.entity';
export const HOTEL_IMAGE_REPOSITORY = Symbol('HOTEL_IMAGE_REPOSITORY');

export interface CreateHotelImageData {
  id: string;
  hotelId: string;
  objectKey: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
}

export interface HotelImageRepository {
  create(data: CreateHotelImageData): Promise<HotelImageEntity>;
  find(hotelId: string, imageId: string): Promise<HotelImageEntity | null>;
  delete(hotelId: string, imageId: string): Promise<void>;
}
