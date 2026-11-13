import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { HotelsService } from './hotels.service';
import { HOTEL_IMAGE_REPOSITORY } from '../interfaces/hotel-image.repository.interface';
import type { HotelImageRepository } from '../interfaces/hotel-image.repository.interface';
import { HOTEL_IMAGE_STORAGE } from '../interfaces/hotel-image-storage.interface';
import type { HotelImageStorage } from '../interfaces/hotel-image-storage.interface';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { UserRole } from '../../users/entities/user.entity';
import { HotelStatus } from '../entities/hotel.entity';
import { HotelUpdateLockedException } from '../exceptions/hotel.exceptions';
import {
  InvalidHotelImageException,
  HotelImageNotFoundException,
} from '../exceptions/hotel-image.exceptions';

export const HOTEL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export interface UploadedHotelImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

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
    if (!file?.buffer?.length || file.buffer.length > HOTEL_IMAGE_MAX_BYTES)
      throw new InvalidHotelImageException();
    let normalized: sharp.OutputInfo & { data: Buffer };
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: 20_000_000,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      const types: Record<string, string> = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };
      if (
        !metadata.format ||
        types[metadata.format] !== file.mimetype ||
        (metadata.pages ?? 1) !== 1
      )
        throw new Error('Invalid image');
      const result = await image
        .rotate()
        .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
      normalized = { ...result.info, data: result.data };
      if (normalized.size > HOTEL_IMAGE_MAX_BYTES)
        throw new Error('Output image too large');
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
  async read(hotelId: string, imageId: string, actor?: AuthorizationActor) {
    if (actor) await this.assertCanManage(hotelId, actor, false);
    else await this.hotels.assertActive(hotelId);
    const image = await this.repository.find(hotelId, imageId);
    if (!image) throw new HotelImageNotFoundException();
    return { image, data: await this.storage.get(image.image.objectKey!) };
  }
  async delete(
    hotelId: string,
    imageId: string,
    actor: AuthorizationActor,
  ): Promise<void> {
    await this.assertCanManage(hotelId, actor);
    const image = await this.repository.find(hotelId, imageId);
    if (!image) throw new HotelImageNotFoundException();
    // Keep metadata if storage is unavailable, so a failed delete can be retried.
    await this.storage.delete(image.image.objectKey!);
    await this.repository.delete(hotelId, imageId);
  }
}
