import sharp from 'sharp';
import { ImageStorageProvider } from '../../media/entities/image.entity';
import { HotelStatus } from '../../hotels/entities/hotel.entity';
import { HotelUpdateLockedException } from '../../hotels/exceptions/hotel.exceptions';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { UserRole } from '../../users/entities/user.entity';
import {
  InvalidRoomImageException,
  RoomImageNotFoundException,
  RoomImageStorageException,
} from '../exceptions/room-image.exceptions';
import { RoomNotFoundException } from '../exceptions/room.exceptions';
import { RoomImagesService } from './room-images.service';

describe('RoomImagesService', () => {
  const repository = {
    room: jest.fn(),
    find: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    makePrimary: jest.fn(),
  };
  const hotels = { assertManagedBy: jest.fn(), assertActive: jest.fn() };
  const storage = { put: jest.fn(), get: jest.fn(), delete: jest.fn() };
  const service = new RoomImagesService(repository, hotels as never, storage);
  const actor = { id: 'owner', role: UserRole.HOTEL_OWNER };
  const fallbackUrl =
    'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1800&q=80';
  const link = () => ({
    id: 'image',
    imageId: 'image',
    roomId: 'room',
    image: {
      storageProvider: ImageStorageProvider.MINIO,
      objectKey: 'rooms/room/image.webp',
      contentType: 'image/webp',
      fallbackUrl,
      sourceProvider: null,
    },
  });
  let png: Buffer;
  beforeAll(async () => {
    png = await sharp({
      create: { width: 16, height: 12, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    repository.room.mockResolvedValue({ id: 'room', hotelId: 'hotel' });
    hotels.assertManagedBy.mockResolvedValue({ status: HotelStatus.ACTIVE });
    repository.find.mockResolvedValue(link());
    repository.create.mockImplementation(async (data) => data);
  });
  it('reads MinIO first without using the original URL', async () => {
    storage.get.mockResolvedValue(Buffer.from('image'));
    await expect(service.read('room', 'image')).resolves.toEqual({
      kind: 'stored',
      data: Buffer.from('image'),
      contentType: 'image/webp',
    });
    expect(hotels.assertActive).toHaveBeenCalledWith('hotel');
    expect(storage.get).toHaveBeenCalledWith('rooms/room/image.webp');
  });
  it('uses the trusted original only after a failed MinIO read', async () => {
    storage.get.mockRejectedValue(new Error('offline'));
    await expect(service.read('room', 'image')).resolves.toEqual({
      kind: 'fallback',
      fallbackUrl,
    });
  });
  it('does not redirect to an arbitrary source', async () => {
    const row = link();
    row.image.fallbackUrl = 'https://outside.example/photo.jpg';
    repository.find.mockResolvedValue(row);
    storage.get.mockRejectedValue(new Error('offline'));
    await expect(service.read('room', 'image')).rejects.toBeInstanceOf(
      RoomImageStorageException,
    );
  });
  it('conceals rooms in inactive hotels on public reads', async () => {
    hotels.assertActive.mockRejectedValue(new Error('inactive'));
    await expect(service.read('room', 'image')).rejects.toThrow('inactive');
    expect(storage.get).not.toHaveBeenCalled();
  });
  it('returns not found for absent rooms and absent image links', async () => {
    repository.room.mockResolvedValueOnce(null);
    await expect(service.list('missing')).rejects.toBeInstanceOf(
      RoomNotFoundException,
    );
    repository.find.mockResolvedValue(null);
    await expect(service.read('room', 'missing')).rejects.toBeInstanceOf(
      RoomImageNotFoundException,
    );
  });
  it('normalizes valid uploads to WebP and creates an exclusive room key', async () => {
    await service.upload('room', { buffer: png, mimetype: 'image/png' }, actor);
    const [key, data, contentType] = storage.put.mock.calls[0] as [
      string,
      Buffer,
      string,
    ];
    expect(key).toMatch(/^rooms\/room\/[a-f0-9-]+\.webp$/);
    expect(contentType).toBe('image/webp');
    expect((await sharp(data).metadata()).format).toBe('webp');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room',
        objectKey: key,
        width: 16,
        height: 12,
      }),
    );
  });
  it.each([
    undefined,
    { buffer: Buffer.from('fake'), mimetype: 'image/png' },
    { buffer: Buffer.alloc(5 * 1024 * 1024 + 1), mimetype: 'image/png' },
  ])('rejects invalid upload bytes', async (file) => {
    await expect(service.upload('room', file, actor)).rejects.toBeInstanceOf(
      InvalidRoomImageException,
    );
    expect(storage.put).not.toHaveBeenCalled();
  });
  it('rejects forged content types', async () => {
    await expect(
      service.upload('room', { buffer: png, mimetype: 'image/jpeg' }, actor),
    ).rejects.toBeInstanceOf(InvalidRoomImageException);
  });
  it('checks the room hotel ownership before processing a file', async () => {
    hotels.assertManagedBy.mockRejectedValue(
      new AuthorizationDeniedException(),
    );
    await expect(
      service.upload('room', undefined, actor),
    ).rejects.toBeInstanceOf(AuthorizationDeniedException);
    expect(hotels.assertManagedBy).toHaveBeenCalledWith('hotel', actor, {
      requiresActiveHotel: true,
    });
    expect(storage.put).not.toHaveBeenCalled();
  });
  it('rejects tourists and locks all mutations while pending approval', async () => {
    await expect(
      service.list('room', { ...actor, role: UserRole.TOURIST }),
    ).rejects.toBeInstanceOf(AuthorizationDeniedException);
    hotels.assertManagedBy.mockResolvedValue({
      status: HotelStatus.PENDING_APPROVAL,
    });
    for (const action of [
      () => service.upload('room', undefined, actor),
      () => service.delete('room', 'image', actor),
      () => service.makePrimary('room', 'image', actor),
    ])
      await expect(action()).rejects.toBeInstanceOf(HotelUpdateLockedException);
    repository.list.mockResolvedValue([]);
    await expect(service.list('room', actor)).resolves.toEqual([]);
  });
  it('does not persist metadata if object storage fails', async () => {
    storage.put.mockRejectedValue(new Error('offline'));
    await expect(
      service.upload('room', { buffer: png, mimetype: 'image/png' }, actor),
    ).rejects.toThrow('offline');
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('cleans up an upload when persistence fails', async () => {
    repository.create.mockRejectedValue(new Error('database'));
    await expect(
      service.upload('room', { buffer: png, mimetype: 'image/png' }, actor),
    ).rejects.toThrow('database');
    expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
  });
  it('keeps shared seed objects when unlinking a photo', async () => {
    const row = link();
    row.image.objectKey = 'demo-lodging/rooms/shared.webp';
    repository.find.mockResolvedValue(row);
    await service.delete('room', 'image', actor);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(repository.delete).toHaveBeenCalledWith('room', 'image', false);
  });
  it('retains metadata if deleting an exclusive upload fails', async () => {
    storage.delete.mockRejectedValue(new Error('offline'));
    await expect(service.delete('room', 'image', actor)).rejects.toThrow(
      'offline',
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });
  it('chooses the cover only within the authorized room', async () => {
    repository.makePrimary.mockResolvedValue(link());
    await service.makePrimary('room', 'image', actor);
    expect(repository.makePrimary).toHaveBeenCalledWith('room', 'image');
    repository.makePrimary.mockResolvedValue(null);
    await expect(
      service.makePrimary('room', 'foreign', actor),
    ).rejects.toBeInstanceOf(RoomImageNotFoundException);
  });
});
