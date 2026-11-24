import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ImageEntity,
  ImageStorageProvider,
} from '../../media/entities/image.entity';
import { makeLodgingImagePrimary } from '../../media/reorder-lodging-images';
import { RoomImageEntity } from '../entities/room-image.entity';
import { RoomEntity } from '../entities/room.entity';
import type {
  CreateRoomImageData,
  RoomImageRepository,
} from '../interfaces/room-image.repository.interface';

@Injectable()
export class TypeOrmRoomImageRepository implements RoomImageRepository {
  constructor(
    @InjectRepository(RoomImageEntity)
    private readonly images: Repository<RoomImageEntity>,
    @InjectRepository(RoomEntity)
    private readonly rooms: Repository<RoomEntity>,
  ) {}
  room(roomId: string) {
    return this.rooms.findOneBy({ id: roomId });
  }
  list(roomId: string) {
    return this.images.find({
      where: { roomId },
      order: { imageOrder: 'ASC', id: 'ASC' },
    });
  }
  find(roomId: string, imageId: string) {
    return this.images.findOneBy({ id: imageId, roomId });
  }
  create(data: CreateRoomImageData): Promise<RoomImageEntity> {
    return this.images.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `room-images:${data.roomId}`,
      ]);
      const [order] = (await manager.query(
        'SELECT COALESCE(MAX(image_order),0)+1 AS value FROM room_images WHERE room_id=$1 AND deleted_at IS NULL',
        [data.roomId],
      )) as Array<{ value: number }>;
      const image = await manager.getRepository(ImageEntity).save(
        manager.getRepository(ImageEntity).create({
          id: data.id,
          storageProvider: ImageStorageProvider.MINIO,
          objectKey: data.objectKey,
          imageUrl: null,
          fallbackUrl: null,
          contentType: data.contentType,
          byteSize: data.byteSize,
          width: data.width,
          height: data.height,
          altText: null,
          sourceProvider: null,
          sourceUrl: null,
          attributionText: null,
        }),
      );
      return manager
        .getRepository(RoomImageEntity)
        .save(
          manager
            .getRepository(RoomImageEntity)
            .create({
              id: data.id,
              roomId: data.roomId,
              imageId: image.id,
              imageOrder: order.value,
              image,
            }),
        );
    });
  }
  async delete(
    roomId: string,
    imageId: string,
    deleteOwnedImage: boolean,
  ): Promise<void> {
    await this.images.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `room-images:${roomId}`,
      ]);
      const link = await manager
        .getRepository(RoomImageEntity)
        .findOneBy({ id: imageId, roomId });
      if (!link) return;
      await manager.getRepository(RoomImageEntity).softDelete(link.id);
      if (deleteOwnedImage)
        await manager.getRepository(ImageEntity).softDelete(link.imageId);
    });
  }
  async makePrimary(
    roomId: string,
    imageId: string,
  ): Promise<RoomImageEntity | null> {
    const found = await this.images.manager.transaction((manager) =>
      makeLodgingImagePrimary(manager, 'room', roomId, imageId),
    );
    return found ? this.find(roomId, imageId) : null;
  }
}
