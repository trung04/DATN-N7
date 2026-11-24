import type { HotelImageEntity } from '../entities/hotel-image.entity';
import type { HotelImageResponse } from '../dtos/responses/hotel-image.response';
import { ImageStorageProvider } from '../../media/entities/image.entity';

export function toHotelImageResponse(
  image: HotelImageEntity,
): HotelImageResponse {
  const media = image.image;
  const imageUrl =
    media.storageProvider === ImageStorageProvider.EXTERNAL
      ? media.imageUrl
      : null;
  return {
    id: image.id,
    hotelId: image.hotelId,
    url:
      imageUrl ?? `/api/v1/hotels/${image.hotelId}/images/${image.id}/file`,
    previewUrl:
      imageUrl ??
      `/api/v1/hotels/mine/${image.hotelId}/images/${image.id}/file`,
    contentType: media.contentType,
    byteSize: media.byteSize,
    width: media.width,
    height: media.height,
    createdAt: image.createdAt.toISOString(),
    imageOrder: image.imageOrder,
    sourceUrl: media.sourceUrl,
    attributionText: media.attributionText,
    illustrative: media.sourceProvider === 'UNSPLASH',
  };
}
