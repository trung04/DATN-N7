import {
  PlaceListResponse,
  PlaceResponse,
} from '../dtos/responses/place.response';
import { PlaceEntity } from '../entities/place.entity';

export class PlaceMapper {
  static toResponse(place: PlaceEntity): PlaceResponse {
    return {
      id: place.id,
      name: place.name,
      description: place.description,
      address: place.address,
      countryCode: place.countryCode,
      provinceCode: place.provinceCode,
      timezone: place.timezone,
      latitude: place.latitude,
      longitude: place.longitude,
      status: place.status,
      averageRating: place.averageRating,
      externalProviderId: place.externalProviderId,
      openingTime: place.openingTime,
    };
  }

  static toListResponse(
    places: PlaceEntity[],
    page: number,
    limit: number,
    total: number,
  ): PlaceListResponse {
    return {
      data: places.map((place) => this.toResponse(place)),
      meta: { page, limit, total },
    };
  }
}
