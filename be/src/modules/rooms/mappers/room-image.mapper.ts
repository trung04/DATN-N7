import type { RoomImageEntity } from '../entities/room-image.entity';
import type { RoomImageResponse } from '../dtos/responses/room-image.response';
export function toRoomImageResponse(link: RoomImageEntity): RoomImageResponse {
  const image = link.image;
  return {
    id: link.id,
    roomId: link.roomId,
    url: `/api/v1/rooms/${link.roomId}/images/${link.id}/file`,
    previewUrl: `/api/v1/rooms/mine/${link.roomId}/images/${link.id}/file`,
    imageOrder: link.imageOrder,
    contentType: image.contentType,
    byteSize: image.byteSize,
    width: image.width,
    height: image.height,
    sourceUrl: image.sourceUrl,
    attributionText: image.attributionText,
    illustrative: image.sourceProvider === 'UNSPLASH',
    createdAt: link.createdAt.toISOString(),
  };
}
