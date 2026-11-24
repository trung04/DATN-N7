import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ImageStorageProvider } from '../../media/entities/image.entity';
import { RoomImagesService } from './room-images.service';

describe('RoomImagesService', () => {
  const dataSource = { query: jest.fn() };
  const storage = { get: jest.fn() };
  const service = new RoomImagesService(dataSource as never, storage as never);

  beforeEach(() => jest.resetAllMocks());

  it('reads the room photo from MinIO first', async () => {
    const image = {
      storageProvider: ImageStorageProvider.MINIO,
      objectKey: 'rooms/room/photo.webp',
      fallbackUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1800&q=80',
      imageUrl: null,
      contentType: 'image/webp',
    };
    dataSource.query.mockResolvedValue([image]);
    storage.get.mockResolvedValue(Buffer.from('room image'));

    await expect(service.read('room', 'image')).resolves.toEqual({
      kind: 'stored',
      data: Buffer.from('room image'),
      contentType: 'image/webp',
    });
    expect(storage.get).toHaveBeenCalledWith('rooms/room/photo.webp');
  });

  it('uses the trusted source URL if the MinIO read fails', async () => {
    const fallbackUrl =
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1800&q=80';
    dataSource.query.mockResolvedValue([
      {
        storageProvider: ImageStorageProvider.MINIO,
        objectKey: 'rooms/room/photo.webp',
        fallbackUrl,
        imageUrl: null,
        contentType: 'image/webp',
      },
    ]);
    storage.get.mockRejectedValue(new Error('MinIO unavailable'));

    await expect(service.read('room', 'image')).resolves.toEqual({
      kind: 'fallback',
      fallbackUrl,
    });
  });

  it('does not redirect to untrusted image URLs', async () => {
    dataSource.query.mockResolvedValue([
      {
        storageProvider: ImageStorageProvider.MINIO,
        objectKey: 'rooms/room/photo.webp',
        fallbackUrl: 'https://outside.example/image.webp',
        imageUrl: null,
        contentType: 'image/webp',
      },
    ]);
    storage.get.mockRejectedValue(new Error('MinIO unavailable'));

    await expect(service.read('room', 'image')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('hides photos for missing or inactive rooms', async () => {
    dataSource.query.mockResolvedValue([]);

    await expect(service.read('room', 'image')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
