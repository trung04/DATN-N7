import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { normalizeLodgingImage } from '../../media/normalize-lodging-image';
import { HotelsService } from './hotels.service';
import { HOTEL_IMAGE_REPOSITORY } from '../interfaces/hotel-image.repository.interface';
import type { HotelImageRepository } from '../interfaces/hotel-image.repository.interface';
import { HOTEL_IMAGE_STORAGE } from '../interfaces/hotel-image-storage.interface';
import type { HotelImageStorage } from '../interfaces/hotel-image-storage.interface';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { UserRole } from '../../users/entities/user.entity';
import { HotelStatus } from '../entities/hotel.entity';
import { ImageStorageProvider } from '../../media/entities/image.entity';
import { HotelUpdateLockedException } from '../exceptions/hotel.exceptions';
import { safeImageFallbackUrl } from '../../media/safe-image-fallback';
import {
  InvalidHotelImageException,
  HotelImageNotFoundException,
  HotelImageStorageException,
} from '../exceptions/hotel-image.exceptions';
import type { HotelImageEntity } from '../entities/hotel-image.entity';

export const HOTEL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export interface UploadedHotelImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export type HotelImageReadResult =
  | { kind: 'stored'; image: HotelImageEntity; data: Buffer }
  | { kind: 'fallback'; image: HotelImageEntity; fallbackUrl: string };

@Injectable()
export class HotelImagesService {
  private readonly logger = new Logger(HotelImagesService.name);
  constructor(
    private readonly hotels: HotelsService,
    @Inject(HOTEL_IMAGE_REPOSITORY)
    private readonly repository: HotelImageRepository,
    @Inject(HOTEL_IMAGE_STORAGE) private readonly storage: HotelImageStorage,
  ) {}
  async assertCanManage(
    hotelId: string,
    actor: AuthorizationActor,
    mutate = true,
  ): Promise<void> {
    if (![UserRole.ADMIN, UserRole.HOTEL_OWNER].includes(actor.role))
      throw new AuthorizationDeniedException();
    const hotel = await this.hotels.assertManagedBy(hotelId, actor);
    if (mutate && hotel.status === HotelStatus.PENDING_APPROVAL)
      throw new HotelUpdateLockedException();
  }
  async upload(
    hotelId: string,
    file: UploadedHotelImage | undefined,
    actor: AuthorizationActor,
  ) {
    await this.assertCanManage(hotelId, actor);
    let normalized: Awaited<ReturnType<typeof normalizeLodgingImage>>;
    try {
      normalized = await normalizeLodgingImage(file);
    } catch {
      throw new InvalidHotelImageException();
    }
    const id = randomUUID();
    const objectKey = `hotels/${hotelId}/${id}.webp`;
    await this.storage.put(objectKey, normalized.data, 'image/webp');
    try {
      return await this.repository.create({
        id,
        hotelId,
        objectKey,
        contentType: 'image/webp',
        byteSize: normalized.size,
        width: normalized.width,
        height: normalized.height,
      });
    } catch (error) {
      try {
        await this.storage.delete(objectKey);
      } catch {
        this.logger.error(
          `Failed to clean up unlinked hotel image: ${objectKey}`,
        );
      }
      throw error;
    }
  }
  async read(
    hotelId: string,
    imageId: string,
    actor?: AuthorizationActor,
  ): Promise<HotelImageReadResult> {
    if (actor) await this.assertCanManage(hotelId, actor, false);
    else await this.hotels.assertActive(hotelId);
    const image = await this.repository.find(hotelId, imageId);
    if (!image) throw new HotelImageNotFoundException();
    const media = image.image;
    const fallbackUrl = safeImageFallbackUrl(
      media.storageProvider === ImageStorageProvider.MINIO
        ? media.fallbackUrl
        : media.imageUrl,
    );

    if (
      media.storageProvider === ImageStorageProvider.MINIO &&
      media.objectKey
    ) {
      try {
        return {
          kind: 'stored',
          image,
          data: await this.storage.get(media.objectKey),
        };
      } catch (error) {
        if (fallbackUrl) return { kind: 'fallback', image, fallbackUrl };
        throw error;
      }
    }

    if (fallbackUrl) return { kind: 'fallback', image, fallbackUrl };
    throw new HotelImageStorageException();
  }
  async delete(
    hotelId: string,
    imageId: string,
    actor: AuthorizationActor,
  ): Promise<void> {
    await this.assertCanManage(hotelId, actor);
    const image = await this.repository.find(hotelId, imageId);
    if (!image) throw new HotelImageNotFoundException();
    const owned =
      image.imageId === image.id &&
      image.image.storageProvider === ImageStorageProvider.MINIO &&
      !image.image.sourceProvider &&
      image.image.objectKey === `hotels/${hotelId}/${imageId}.webp`;
    if (owned) await this.storage.delete(image.image.objectKey!);
    await this.repository.delete(hotelId, imageId, owned);
  }
  async makePrimary(
    hotelId: string,
    imageId: string,
    actor: AuthorizationActor,
  ) {
    await this.assertCanManage(hotelId, actor);
    const image = await this.repository.makePrimary(hotelId, imageId);
    if (!image) throw new HotelImageNotFoundException();
    return image;
  }
}
