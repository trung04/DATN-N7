import type { HotelImageEntity } from '../entities/hotel-image.entity';
import type { HotelImageResponse } from '../dtos/responses/hotel-image.response';

export function toHotelImageResponse(
  image: HotelImageEntity,
): HotelImageResponse {
  const media = image.image;
  return {
    id: image.id,
    hotelId: image.hotelId,
    url: `/api/v1/hotels/${image.hotelId}/images/${image.id}/file`,
    previewUrl: `/api/v1/hotels/mine/${image.hotelId}/images/${image.id}/file`,
    contentType: media.contentType!,
    byteSize: media.byteSize!,
    width: media.width!,
    height: media.height!,
    createdAt: image.createdAt.toISOString(),
  };
}
