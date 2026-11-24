import {
  RoomListResponse,
  RoomResponse,
} from '../dtos/responses/room.response';
import type {
  RoomResultPage,
  RoomWithAmenities,
} from '../interfaces/room-result.interface';

export class RoomMapper {
  static toResponse(result: RoomWithAmenities): RoomResponse {
    const { room, amenities } = result;
    return {
      id: room.id,
      hotelId: room.hotelId,
      roomNumber: room.roomNumber,
      maxOccupancy: room.maxOccupancy,
      pricePerNight: room.pricePerNight,
      currency: room.currency,
      description: room.description,
      operationalStatus: room.operationalStatus,
      roomType: room.roomType,
      amenities: amenities.map((amenity) => ({
        id: amenity.id,
        code: amenity.code,
        name: amenity.name,
      })),
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
    };
  }

  static toListResponse(
    page: RoomResultPage,
    pageNumber: number,
    limit: number,
  ): RoomListResponse {
    return {
      data: page.items.map((item) => this.toResponse(item)),
      meta: { page: pageNumber, limit, total: page.total },
    };
  }
}
