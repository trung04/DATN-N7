import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { makeLodgingImagePrimary } from '../../media/reorder-lodging-images';
import {
  ImageEntity,
  ImageStorageProvider,
} from '../../media/entities/image.entity';
import { HotelImageEntity } from '../entities/hotel-image.entity';
import { HotelEntity, HotelStatus } from '../entities/hotel.entity';
import type {
  CreateHotelImageData,
  HotelImageRepository,
} from '../interfaces/hotel-image.repository.interface';

@Injectable()
export class TypeOrmHotelImageRepository implements HotelImageRepository {
  constructor(
    @InjectRepository(HotelImageEntity)
    private readonly repository: Repository<HotelImageEntity>,
  ) {}
  create(data: CreateHotelImageData): Promise<HotelImageEntity> {
    return this.repository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `hotel-images:${data.hotelId}`,
      ]);
      const [{ imageOrder }] = (await manager.query(
        `SELECT COALESCE(MAX("image_order"), 0) + 1 AS "imageOrder"
           FROM "hotel_images"
          WHERE "hotel_id" = $1 AND "deleted_at" IS NULL`,
        [data.hotelId],
      )) as Array<{ imageOrder: number }>;
      const image = manager.getRepository(ImageEntity).create({
        id: data.id,
        storageProvider: ImageStorageProvider.MINIO,
        objectKey: data.objectKey,
        imageUrl: null,
        contentType: data.contentType,
        byteSize: data.byteSize,
        width: data.width,
        height: data.height,
        altText: null,
        sourceProvider: null,
        sourceUrl: null,
        attributionText: null,
      });
      await manager.getRepository(ImageEntity).save(image);
      return manager.getRepository(HotelImageEntity).save(
        manager.getRepository(HotelImageEntity).create({
          id: data.id,
          hotelId: data.hotelId,
          imageId: image.id,
          imageOrder,
          image,
        }),
      );
    });
  }
  find(hotelId: string, id: string) {
    return this.repository.findOne({ where: { hotelId, id } });
  }
  async makePrimary(hotelId: string, id: string) {
    return this.repository.manager.transaction(async (manager) => {
      if (!(await makeLodgingImagePrimary(manager, 'hotel', hotelId, id)))
        return null;
      return manager
        .getRepository(HotelImageEntity)
        .findOne({ where: { hotelId, id } });
    });
  }
  async delete(
    hotelId: string,
    id: string,
    beforeDelete: (image: HotelImageEntity, status: HotelStatus) => Promise<boolean>,
  ): Promise<boolean> {
    const runner = this.repository.manager.connection.createQueryRunner();
    const key = [`hotel-images:${hotelId}`];
    try {
      // Keep uploads and submission serialized with deletion while storage I/O runs outside a transaction.
      await runner.query('SELECT pg_advisory_lock(hashtext($1))', key);
      try {
        const hotel = await runner.manager.findOneBy(HotelEntity, { id: hotelId });
        const link = await runner.manager.findOneBy(HotelImageEntity, { hotelId, id });
        if (!hotel || !link) return false;
        const deleteOwnedImage = await beforeDelete(link, hotel.status);
        await runner.manager.transaction(async (manager) => {
          await manager.softDelete(HotelImageEntity, link.id);
          if (deleteOwnedImage) await manager.softDelete(ImageEntity, link.imageId);
        });
        return true;
      } finally {
        await runner.query('SELECT pg_advisory_unlock(hashtext($1))', key);
      }
    } finally {
      await runner.release();
    }
  }
}
