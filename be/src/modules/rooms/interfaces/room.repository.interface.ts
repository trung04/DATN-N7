import { RoomOperationalStatus, RoomEntity } from '../entities/room.entity';

export const ROOM_REPOSITORY = Symbol('ROOM_REPOSITORY');

export type RoomSortField =
  'roomNumber' | 'maxOccupancy' | 'pricePerNight' | 'createdAt' | 'updatedAt';

export interface RoomWithAmenityIds {
  room: RoomEntity;
  amenityIds: string[];
}

export interface RoomPage {
  items: RoomWithAmenityIds[];
  total: number;
}

export interface FindRoomsOptions {
  page: number;
  limit: number;
  search?: string;
  hotelId?: string;
  roomType?: string;
  operationalStatus?: RoomOperationalStatus;
  sortBy: RoomSortField;
  sortOrder: 'ASC' | 'DESC';
}

export interface CreateRoomData {
  hotelId: string;
  roomNumber: string;
  maxOccupancy: number;
  pricePerNight: number;
  currency: string;
  description: string | null;
  operationalStatus: RoomOperationalStatus;
  roomType: string;
}

export interface RoomRepository {
  findBookableByHotel(hotelId?: string): Promise<RoomEntity[]>;
  findById(id: string): Promise<RoomWithAmenityIds | null>;
  findByIds(ids: string[]): Promise<RoomEntity[]>;
  findByHotelAndNumber(
    hotelId: string,
    roomNumber: string,
  ): Promise<RoomEntity | null>;
  findPage(options: FindRoomsOptions): Promise<RoomPage>;
  create(
    data: CreateRoomData,
    amenityIds: string[],
  ): Promise<RoomWithAmenityIds>;
  save(room: RoomEntity, amenityIds?: string[]): Promise<RoomWithAmenityIds>;
  delete(room: RoomEntity): Promise<void>;
}
