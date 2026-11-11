export const HOTEL_IMAGE_STORAGE = Symbol('HOTEL_IMAGE_STORAGE');
export interface HotelImageStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
