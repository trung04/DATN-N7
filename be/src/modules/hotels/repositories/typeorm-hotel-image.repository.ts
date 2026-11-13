import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ImageEntity,
  ImageStorageProvider,
} from '../../media/entities/image.entity';
import { HotelImageEntity } from '../entities/hotel-image.entity';
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
  async delete(hotelId: string, id: string): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      const link = await manager
        .getRepository(HotelImageEntity)
        .findOne({ where: { hotelId, id } });
      if (!link) return;
      await manager.getRepository(HotelImageEntity).softDelete(link.id);
      await manager.getRepository(ImageEntity).softDelete(link.imageId);
    });
  }
}
