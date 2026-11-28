import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ImageStorageProvider } from '../../media/entities/image.entity';
import { safeImageFallbackUrl } from '../../media/safe-image-fallback';
import {
  normalizeLodgingImage,
  type UploadedLodgingImage,
} from '../../media/normalize-lodging-image';
import { HOTEL_IMAGE_STORAGE } from '../../hotels/interfaces/hotel-image-storage.interface';
import type { HotelImageStorage } from '../../hotels/interfaces/hotel-image-storage.interface';
import { HotelsService } from '../../hotels/services/hotels.service';
import { HotelStatus } from '../../hotels/entities/hotel.entity';
import {
  HotelNotActiveException,
  HotelUpdateLockedException,
} from '../../hotels/exceptions/hotel.exceptions';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { UserRole } from '../../users/entities/user.entity';
import { ROOM_IMAGE_REPOSITORY } from '../interfaces/room-image.repository.interface';
import type { RoomImageRepository } from '../interfaces/room-image.repository.interface';
import { RoomNotFoundException } from '../exceptions/room.exceptions';
import {
  InvalidRoomImageException,
  RoomImageNotFoundException,
  RoomImageStorageException,
} from '../exceptions/room-image.exceptions';

export type RoomImageReadResult =
  | { kind: 'stored'; data: Buffer; contentType: string }
  | { kind: 'fallback'; fallbackUrl: string };

@Injectable()
export class RoomImagesService {
  private readonly logger = new Logger(RoomImagesService.name);
  constructor(
    @Inject(ROOM_IMAGE_REPOSITORY)
    private readonly repository: RoomImageRepository,
    private readonly hotels: HotelsService,
    @Inject(HOTEL_IMAGE_STORAGE) private readonly storage: HotelImageStorage,
  ) {}
  private async room(roomId: string) {
    const room = await this.repository.room(roomId);
    if (!room) throw new RoomNotFoundException(roomId);
    return room;
  }
  async assertCanManage(
    roomId: string,
    actor: AuthorizationActor,
    mutate = true,
  ) {
    if (![UserRole.ADMIN, UserRole.HOTEL_OWNER].includes(actor.role))
      throw new AuthorizationDeniedException();
    const room = await this.room(roomId);
    const hotel = await this.hotels.assertManagedBy(room.hotelId, actor, {
      requiresActiveHotel: mutate,
    });
    if (mutate && hotel.status === HotelStatus.PENDING_APPROVAL)
      throw new HotelUpdateLockedException();
    return room;
  }
  private async assertRead(roomId: string, actor?: AuthorizationActor) {
    if (actor) await this.assertCanManage(roomId, actor, false);
    else {
      const room = await this.room(roomId);
      try {
        await this.hotels.assertActive(room.hotelId);
      } catch (error) {
        if (error instanceof HotelNotActiveException)
          throw new RoomNotFoundException(roomId);
        throw error;
      }
    }
  }
  async list(roomId: string, actor?: AuthorizationActor) {
    await this.assertRead(roomId, actor);
    return this.repository.list(roomId);
  }
  async upload(
    roomId: string,
    file: UploadedLodgingImage | undefined,
    actor: AuthorizationActor,
  ) {
    await this.assertCanManage(roomId, actor);
    let image: Awaited<ReturnType<typeof normalizeLodgingImage>>;
    try {
      image = await normalizeLodgingImage(file);
    } catch {
      throw new InvalidRoomImageException();
    }
    const id = randomUUID();
    const objectKey = `rooms/${roomId}/${id}.webp`;
    await this.storage.put(objectKey, image.data, 'image/webp');
    try {
      return await this.repository.create({
        id,
        roomId,
        objectKey,
        contentType: 'image/webp',
        byteSize: image.size,
        width: image.width,
        height: image.height,
      });
    } catch (error) {
      try {
        await this.storage.delete(objectKey);
      } catch {
        this.logger.error('Failed to remove an unlinked room upload.');
      }
      throw error;
    }
  }
  async read(
    roomId: string,
    imageId: string,
    actor?: AuthorizationActor,
  ): Promise<RoomImageReadResult> {
    await this.assertRead(roomId, actor);
    const link = await this.repository.find(roomId, imageId);
    if (!link) throw new RoomImageNotFoundException();
    const image = link.image;
    const fallbackUrl = safeImageFallbackUrl(
      image.storageProvider === ImageStorageProvider.MINIO
        ? image.fallbackUrl
        : image.imageUrl,
    );
    if (
      image.storageProvider === ImageStorageProvider.MINIO &&
      image.objectKey
    ) {
      try {
        return {
          kind: 'stored',
          data: await this.storage.get(image.objectKey),
          contentType: image.contentType ?? 'application/octet-stream',
        };
      } catch {
        if (fallbackUrl) return { kind: 'fallback', fallbackUrl };
        throw new RoomImageStorageException();
      }
    }
    if (fallbackUrl) return { kind: 'fallback', fallbackUrl };
    throw new RoomImageStorageException();
  }
  async delete(
    roomId: string,
    imageId: string,
    actor: AuthorizationActor,
  ): Promise<void> {
    await this.assertCanManage(roomId, actor);
    const link = await this.repository.find(roomId, imageId);
    if (!link) throw new RoomImageNotFoundException();
    const owned =
      link.imageId === link.id &&
      link.image.storageProvider === ImageStorageProvider.MINIO &&
      !link.image.sourceProvider &&
      link.image.objectKey === `rooms/${roomId}/${imageId}.webp`;
    if (owned) await this.storage.delete(link.image.objectKey!);
    await this.repository.delete(roomId, imageId, owned);
  }
  async makePrimary(
    roomId: string,
    imageId: string,
    actor: AuthorizationActor,
  ) {
    await this.assertCanManage(roomId, actor);
    const image = await this.repository.makePrimary(roomId, imageId);
    if (!image) throw new RoomImageNotFoundException();
    return image;
  }
}
