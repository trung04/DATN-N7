import type {
  HotelDocumentEntity,
  HotelDocumentType,
} from '../entities/hotel-document.entity';
import type {
  HotelReviewAction,
  HotelReviewHistoryEntity,
} from '../entities/hotel-review-history.entity';
import type { HotelEntity, HotelStatus } from '../entities/hotel.entity';

export const HOTEL_REPOSITORY = Symbol('HOTEL_REPOSITORY');

export type HotelSortField = 'createdAt' | 'name' | 'status';

export interface FindHotelsOptions {
  page: number;
  limit: number;
  search?: string;
  ownerUserId?: string;
  placeId?: string;
  status?: HotelStatus;
  sortBy: HotelSortField;
  sortOrder: 'ASC' | 'DESC';
}

export interface HotelPage {
  items: HotelEntity[];
  total: number;
}

export interface CreateHotelData {
  ownerUserId: string;
  placeId: string | null;
  name: string;
  legalName: string;
  taxCode: string;
  description: string | null;
  address: string;
  phoneNumber: string;
  email: string;
  starRating: number | null;
  checkInTime: string;
  checkOutTime: string;
  status: HotelStatus;
}

export interface CreateHotelDocumentData {
  hotelId: string;
  documentType: HotelDocumentType;
  documentNumber: string;
  fileUrl: string;
  issuedAt: string | null;
  expiresAt: string | null;
}

export interface CreateHotelReviewData {
  hotelId: string;
  actorUserId: string;
  action: HotelReviewAction;
  reason: string | null;
}

export interface HotelRepository {
  findById(id: string): Promise<HotelEntity | null>;
  findByTaxCode(taxCode: string): Promise<HotelEntity | null>;
  findPage(options: FindHotelsOptions): Promise<HotelPage>;
  create(data: CreateHotelData): Promise<HotelEntity>;
  save(hotel: HotelEntity): Promise<HotelEntity>;
  saveWithReview(
    hotel: HotelEntity,
    review: CreateHotelReviewData,
  ): Promise<HotelEntity>;
  createDocument(data: CreateHotelDocumentData): Promise<HotelDocumentEntity>;
  findDocumentById(id: string): Promise<HotelDocumentEntity | null>;
  deleteDocument(document: HotelDocumentEntity): Promise<void>;
  findReviewHistory(hotelId: string): Promise<HotelReviewHistoryEntity[]>;
}
