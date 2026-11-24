import type { AmenityEntity } from '../../amenities/entities/amenity.entity';
import type { RoomEntity } from '../entities/room.entity';

export interface RoomWithAmenities {
  room: RoomEntity;
  amenities: AmenityEntity[];
}

export interface RoomResultPage {
  items: RoomWithAmenities[];
  total: number;
}
