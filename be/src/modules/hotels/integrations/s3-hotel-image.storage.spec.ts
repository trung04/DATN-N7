import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { S3HotelImageStorage } from './s3-hotel-image.storage';
import {
  HotelImageNotFoundException,
  HotelImageStorageException,
} from '../exceptions/hotel-image.exceptions';

describe('S3HotelImageStorage', () => {
  let storage: S3HotelImageStorage;
  const send = jest.spyOn(S3Client.prototype, 'send');
  beforeEach(() => {
    send.mockReset();
    storage = new S3HotelImageStorage(
      new ConfigService({
        S3_ACCESS_KEY: 'test-key',
        S3_SECRET_KEY: 'test-secret',
        S3_HOTEL_IMAGES_BUCKET: 'test-images',
      }),
    );
  });
  afterEach(() => storage.onModuleDestroy());
  afterAll(() => send.mockRestore());
  it('creates a missing private bucket then stores the image without any public ACL', async () => {
    send.mockImplementation((async (command: unknown) => {
      if (command instanceof HeadBucketCommand)
        throw { $metadata: { httpStatusCode: 404 } };
      return {};
    }) as never);
    await storage.put('hotel/image.webp', Buffer.from('bytes'), 'image/webp');
    const commands = send.mock.calls.map((call) => call[0]);
    expect(commands[1]).toBeInstanceOf(CreateBucketCommand);
    expect((commands[2] as PutObjectCommand).input).toMatchObject({
      Bucket: 'test-images',
      Key: 'hotel/image.webp',
      ContentType: 'image/webp',
    });
    expect((commands[2] as PutObjectCommand).input.ACL).toBeUndefined();
  });
  it('does not confuse forbidden bucket access with a missing bucket and retries initialization after failure', async () => {
    send.mockImplementationOnce((async () => {
      throw { $metadata: { httpStatusCode: 403 } };
    }) as never);
    await expect(
      storage.put('key', Buffer.from('bytes'), 'image/webp'),
    ).rejects.toBeInstanceOf(HotelImageStorageException);
    expect(send.mock.calls).toHaveLength(1);
    send.mockImplementation((async () => ({})) as never);
    await storage.put('key', Buffer.from('bytes'), 'image/webp');
    expect(send.mock.calls[1][0]).toBeInstanceOf(HeadBucketCommand);
  });
  it('maps missing objects and storage failures to safe domain errors', async () => {
    send.mockImplementationOnce((async () => {
      throw { name: 'NoSuchKey' };
    }) as never);
    await expect(storage.get('key')).rejects.toBeInstanceOf(
      HotelImageNotFoundException,
    );
    send.mockImplementationOnce((async () => {
      throw new Error('secret upstream detail');
    }) as never);
    await expect(storage.get('key')).rejects.toThrow(
      'Image storage is temporarily unavailable.',
    );
  });
  it('makes deletion idempotent and requires configured credentials', async () => {
    send.mockImplementation((async () => ({})) as never);
    await storage.delete('key');
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    const disabled = new S3HotelImageStorage(new ConfigService());
    await expect(
      disabled.put('key', Buffer.from('x'), 'image/webp'),
    ).rejects.toBeInstanceOf(HotelImageStorageException);
  });
});
