import { HotelOwnerEntity } from '../entities/hotel-owner.entity';

export const HOTEL_OWNER_REPOSITORY = Symbol('HOTEL_OWNER_REPOSITORY');

export type HotelOwnerSortField = 'userId' | 'bankName' | 'bankAccountHolder';

export interface FindHotelOwnersOptions {
  page: number;
  limit: number;
  search?: string;
  userId?: string;
  sortBy: HotelOwnerSortField;
  sortOrder: 'ASC' | 'DESC';
}

export interface HotelOwnerPage {
  items: HotelOwnerEntity[];
  total: number;
}

export interface CreateHotelOwnerData {
  userId: string;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
}

export interface HotelOwnerRepository {
  findByUserId(userId: string): Promise<HotelOwnerEntity | null>;
  findPage(options: FindHotelOwnersOptions): Promise<HotelOwnerPage>;
  create(data: CreateHotelOwnerData): Promise<HotelOwnerEntity>;
  save(hotelOwner: HotelOwnerEntity): Promise<HotelOwnerEntity>;
  delete(hotelOwner: HotelOwnerEntity): Promise<void>;
}
