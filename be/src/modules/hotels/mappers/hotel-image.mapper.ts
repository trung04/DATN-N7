import type { HotelImageEntity } from '../entities/hotel-image.entity';
import type { HotelImageResponse } from '../dtos/responses/hotel-image.response';

export function toHotelImageResponse(
  image: HotelImageEntity,
): HotelImageResponse {
  return {
    id: image.id,
    hotelId: image.hotelId,
    url: `/api/v1/hotels/${image.hotelId}/images/${image.id}/file`,
    previewUrl: `/api/v1/hotels/mine/${image.hotelId}/images/${image.id}/file`,
    contentType: image.contentType,
    byteSize: image.byteSize,
    width: image.width,
    height: image.height,
    createdAt: image.createdAt.toISOString(),
  };
}
