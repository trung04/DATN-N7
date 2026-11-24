import type { HotelDocumentEntity } from '../entities/hotel-document.entity';
import type { HotelEntity } from '../entities/hotel.entity';

export const HOTEL_DOCUMENT_REPOSITORY = Symbol('HOTEL_DOCUMENT_REPOSITORY');

export interface HotelDocumentTransaction {
  hotel: HotelEntity | null;
  find(id: string): Promise<HotelDocumentEntity | null>;
  save(document: HotelDocumentEntity): Promise<HotelDocumentEntity>;
  delete(document: HotelDocumentEntity): Promise<void>;
}

export interface HotelDocumentRepository {
  find(hotelId: string, id: string): Promise<HotelDocumentEntity | null>;
  transaction<T>(hotelId: string, work: (transaction: HotelDocumentTransaction) => Promise<T>): Promise<T>;
}
