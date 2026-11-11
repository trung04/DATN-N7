import type { HotelImageEntity } from '../entities/hotel-image.entity';
export const HOTEL_IMAGE_REPOSITORY = Symbol('HOTEL_IMAGE_REPOSITORY');
export interface HotelImageRepository {
  create(
    data: Omit<HotelImageEntity, 'hotel' | 'createdAt'>,
  ): Promise<HotelImageEntity>;
  find(hotelId: string, imageId: string): Promise<HotelImageEntity | null>;
  delete(hotelId: string, imageId: string): Promise<void>;
}
