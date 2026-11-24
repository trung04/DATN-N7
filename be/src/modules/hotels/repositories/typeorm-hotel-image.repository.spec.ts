import type { EntityManager, Repository } from 'typeorm';
import {
  ImageEntity,
  ImageStorageProvider,
} from '../../media/entities/image.entity';
import { HotelImageEntity } from '../entities/hotel-image.entity';
import { TypeOrmHotelImageRepository } from './typeorm-hotel-image.repository';

describe('TypeOrmHotelImageRepository', () => {
  it('serializes image ordering and writes metadata with its hotel link', async () => {
    const imageRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const linkRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ imageOrder: 2 }]),
      getRepository: jest.fn((entity) =>
        entity === ImageEntity ? imageRepository : linkRepository,
      ),
    } as unknown as EntityManager;
    const typeormRepository = {
      manager: {
        transaction: jest.fn(async (work) => work(manager)),
      },
    } as unknown as Repository<HotelImageEntity>;
    const repository = new TypeOrmHotelImageRepository(typeormRepository);

    const result = await repository.create({
      id: 'image-id',
      hotelId: 'hotel-id',
      objectKey: 'hotels/hotel-id/image-id.webp',
      contentType: 'image/webp',
      byteSize: 100,
      width: 20,
      height: 10,
    });

    expect(manager.query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['hotel-images:hotel-id'],
    );
    expect(imageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        storageProvider: ImageStorageProvider.MINIO,
        objectKey: 'hotels/hotel-id/image-id.webp',
        imageUrl: null,
      }),
    );
    expect(linkRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'image-id',
        hotelId: 'hotel-id',
        imageId: 'image-id',
        imageOrder: 2,
      }),
    );
    expect(result.imageOrder).toBe(2);
  });
});
