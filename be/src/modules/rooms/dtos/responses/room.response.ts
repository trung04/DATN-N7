import { RoomOperationalStatus } from '../../entities/room.entity';

export class RoomAmenityResponse {
  id: string;
  code: string;
  name: string;
}

export class RoomResponse {
  id: string;
  hotelId: string;
  roomNumber: string;
  maxOccupancy: number;
  pricePerNight: number;
  currency: string;
  description: string | null;
  operationalStatus: RoomOperationalStatus;
  roomType: string;
  amenities: RoomAmenityResponse[];
  createdAt: string;
  updatedAt: string;
}

export class RoomListResponse {
  data: RoomResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
