import sharp from 'sharp';
import { HotelImagesService } from './hotel-images.service';
import { HotelsService } from './hotels.service';
import { HotelStatus } from '../entities/hotel.entity';
import { HotelImageEntity } from '../entities/hotel-image.entity';
import { UserRole } from '../../users/entities/user.entity';
import {
  InvalidHotelImageException,
  HotelImageNotFoundException,
  HotelImageStorageException,
} from '../exceptions/hotel-image.exceptions';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { HotelUpdateLockedException } from '../exceptions/hotel.exceptions';

describe('HotelImagesService', () => {
  const actor = { id: 'owner', role: UserRole.HOTEL_OWNER };
  const hotels = { assertManagedBy: jest.fn(), assertActive: jest.fn() };
  const repository = { create: jest.fn(), find: jest.fn(), delete: jest.fn() };
  const storage = { put: jest.fn(), get: jest.fn(), delete: jest.fn() };
  const service = new HotelImagesService(
    hotels as unknown as HotelsService,
    repository,
    storage,
  );
  let png: Buffer;
  beforeAll(async () => {
    png = await sharp({
      create: { width: 10, height: 8, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    hotels.assertManagedBy.mockResolvedValue({ status: HotelStatus.DRAFT });
    repository.create.mockImplementation(async (data) => ({
      ...data,
      createdAt: new Date(),
    }));
  });
  const file = () => ({ buffer: png, size: png.length, mimetype: 'image/png' });
  it('decodes and normalizes an image, generates the key and persists metadata', async () => {
    const result = await service.upload('hotel', file(), actor);
    expect(result.objectKey).toMatch(/^hotels\/hotel\/[a-f0-9-]+\.webp$/);
    expect(result).toMatchObject({
      contentType: 'image/webp',
      width: 10,
      height: 8,
    });
    const saved = storage.put.mock.calls[0][1] as Buffer;
    expect((await sharp(saved).metadata()).format).toBe('webp');
    expect(storage.put).toHaveBeenCalledWith(
      result.objectKey,
      saved,
      'image/webp',
    );
  });
  it.each([
    undefined,
    {
      buffer: Buffer.from('<script>not an image</script>'),
      size: 30,
      mimetype: 'image/png',
    },
    {
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      size: 5 * 1024 * 1024 + 1,
      mimetype: 'image/png',
    },
  ])('rejects missing, fake or oversized data', async (value) => {
    await expect(service.upload('hotel', value, actor)).rejects.toBeInstanceOf(
      InvalidHotelImageException,
    );
    expect(storage.put).not.toHaveBeenCalled();
  });
  it('rejects a forged MIME type', async () => {
    await expect(
      service.upload('hotel', { ...file(), mimetype: 'image/jpeg' }, actor),
    ).rejects.toBeInstanceOf(InvalidHotelImageException);
  });
  it('rejects truncated image content', async () => {
    await expect(
      service.upload(
        'hotel',
        { ...file(), buffer: png.subarray(0, 40) },
        actor,
      ),
    ).rejects.toBeInstanceOf(InvalidHotelImageException);
  });
  it('checks ownership before validating or storing files', async () => {
    hotels.assertManagedBy.mockRejectedValue(
      new AuthorizationDeniedException(),
    );
    await expect(service.upload('hotel', file(), actor)).rejects.toBeInstanceOf(
      AuthorizationDeniedException,
    );
    expect(storage.put).not.toHaveBeenCalled();
  });
  it('rejects tourists and locks changes during approval', async () => {
    await expect(
      service.upload('hotel', file(), { ...actor, role: UserRole.TOURIST }),
    ).rejects.toBeInstanceOf(AuthorizationDeniedException);
    hotels.assertManagedBy.mockResolvedValue({
      status: HotelStatus.PENDING_APPROVAL,
    });
    await expect(service.upload('hotel', file(), actor)).rejects.toBeInstanceOf(
      HotelUpdateLockedException,
    );
  });
  it('does not persist a record when storage fails', async () => {
    storage.put.mockRejectedValue(new HotelImageStorageException());
    await expect(service.upload('hotel', file(), actor)).rejects.toBeInstanceOf(
      HotelImageStorageException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('removes the uploaded object when persistence fails', async () => {
    repository.create.mockRejectedValue(new Error('database unavailable'));
    await expect(service.upload('hotel', file(), actor)).rejects.toThrow(
      'database unavailable',
    );
    expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
  });
  it('never exposes a non-public hotel through the public file route', async () => {
    hotels.assertActive.mockRejectedValue(new Error('not active'));
    await expect(service.read('hotel', 'image')).rejects.toThrow('not active');
    expect(storage.get).not.toHaveBeenCalled();
  });
  it('scopes reads and deletes to the requested hotel', async () => {
    repository.find.mockResolvedValue(null);
    await expect(
      service.read('hotel', 'other-image', actor),
    ).rejects.toBeInstanceOf(HotelImageNotFoundException);
    await expect(
      service.delete('hotel', 'other-image', actor),
    ).rejects.toBeInstanceOf(HotelImageNotFoundException);
    expect(repository.find).toHaveBeenCalledWith('hotel', 'other-image');
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it('retains metadata on a storage deletion failure to allow retry', async () => {
    repository.find.mockResolvedValue({
      objectKey: 'hotels/h/image.webp',
    } as HotelImageEntity);
    storage.delete.mockRejectedValue(new HotelImageStorageException());
    await expect(
      service.delete('hotel', 'image', actor),
    ).rejects.toBeInstanceOf(HotelImageStorageException);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
