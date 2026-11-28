import type { RoomEntity } from '../entities/room.entity';
import type { RoomImageEntity } from '../entities/room-image.entity';
export const ROOM_IMAGE_REPOSITORY = Symbol('ROOM_IMAGE_REPOSITORY');
export interface CreateRoomImageData {
  id: string;
  roomId: string;
  objectKey: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
}
export interface RoomImageRepository {
  room(roomId: string): Promise<RoomEntity | null>;
  list(roomId: string): Promise<RoomImageEntity[]>;
  find(roomId: string, imageId: string): Promise<RoomImageEntity | null>;
  create(data: CreateRoomImageData): Promise<RoomImageEntity>;
  delete(
    roomId: string,
    imageId: string,
    deleteOwnedImage: boolean,
  ): Promise<void>;
  makePrimary(roomId: string, imageId: string): Promise<RoomImageEntity | null>;
}
