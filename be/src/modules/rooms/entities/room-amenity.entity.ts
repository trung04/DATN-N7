import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'room_amenities' })
@Index('IDX_room_amenities_amenity_id', ['amenityId'])
export class RoomAmenityEntity {
  @PrimaryColumn({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @PrimaryColumn({ name: 'amenity_id', type: 'uuid' })
  amenityId: string;
}
