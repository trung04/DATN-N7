import sharp from 'sharp';
import type { ImageStorage } from '../../media/image-storage.interface';
import {
  PlaceEntity,
  PlaceSourceType,
  PlaceStatus,
} from '../entities/place.entity';
import {
  CoordinatePairRequiredException,
  EmptyPlaceUpdateException,
  ExternalProviderConflictException,
} from '../exceptions/place.exceptions';
import { InvalidPlaceImageException, PlaceImageNotFoundException } from '../exceptions/place-image.exceptions';
import type { PlaceRepository } from '../interfaces/place.repository.interface';
import { PlacesService } from './places.service';

const place = (overrides: Partial<PlaceEntity> = {}): PlaceEntity =>
  Object.assign(new PlaceEntity(), {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Hoan Kiem Lake',
    description: null,
    address: 'Hoan Kiem, Hanoi',
    city: 'Hanoi',
    countryCode: 'VN',
    provinceCode: 'HN',
    timezone: 'Asia/Ho_Chi_Minh',
    latitude: 21.0285,
    longitude: 105.8542,
    status: PlaceStatus.ACTIVE,
    averageRating: 0,
    reviewCount: 0,
    externalProviderId: null,
    openingHours: null,
    estimatedVisitDurationMinutes: null,
    amenities: [],
    bestVisitTimes: [],
    suitableFor: [],
    contactPhone: null,
    contactWebsite: null,
    sourceType: PlaceSourceType.MANUAL,
    sourceProvider: null,
    sourceUrl: null,
    attributionText: null,
    licenseCode: null,
    lastRefreshedAt: null,
    catalogVersion: 1,
    ...overrides,
  });

describe('PlacesService', () => {
  let repository: jest.Mocked<PlaceRepository>;
  let service: PlacesService;
  let storage: jest.Mocked<ImageStorage>;
  let createPlace: jest.MockedFunction<PlaceRepository['create']>;
  let savePlace: jest.MockedFunction<PlaceRepository['save']>;

  beforeEach(() => {
    createPlace = jest.fn();
    savePlace = jest.fn();
    repository = {
      findById: jest.fn(),
      findImageObjectKey: jest.fn(),
      findDetailsById: jest.fn(),
      findByExternalProviderId: jest.fn(),
      findPage: jest.fn(),
      findCatalogOptions: jest.fn(),
      create: createPlace,
      save: savePlace,
      delete: jest.fn(),
    };
    storage = { put: jest.fn(), get: jest.fn(), delete: jest.fn() };
    service = new PlacesService(repository, storage);
  });

  it('normalizes place data and initializes the rating', async () => {
    const saved = place();
    repository.findByExternalProviderId.mockResolvedValue(null);
    createPlace.mockResolvedValue(saved);

    await expect(
      service.create({
        name: ' Hoan Kiem Lake ',
        address: ' Hoan Kiem, Hanoi ',
        countryCode: 'vn',
        provinceCode: 'hn',
        timezone: 'Asia/Ho_Chi_Minh',
        latitude: 21.0285,
        longitude: 105.8542,
        status: PlaceStatus.ACTIVE,
        externalProviderId: ' google-place-1 ',
      }),
    ).resolves.toBe(saved);

    expect(createPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Hoan Kiem Lake',
        address: 'Hoan Kiem, Hanoi',
        countryCode: 'VN',
        provinceCode: 'HN',
        averageRating: 0,
        externalProviderId: 'google-place-1',
      }),
      {},
    );
  });

  it('encodes an uploaded image and saves its stored metadata with the place', async () => {
    const saved = place();
    const buffer = await sharp({ create: { width: 4, height: 3, channels: 3, background: 'navy' } }).png().toBuffer();
    createPlace.mockResolvedValue(saved);

    await expect(service.create({
      name: saved.name,
      latitude: 21.0285,
      longitude: 105.8542,
      status: PlaceStatus.ACTIVE,
      imageAltText: ' Lake view ',
    }, { buffer, mimetype: 'image/png' })).resolves.toBe(saved);

    const [key, stored, type] = storage.put.mock.calls[0];
    expect(key).toMatch(/^places\/[a-f0-9-]+\.webp$/);
    expect(type).toBe('image/webp');
    expect((await sharp(stored).metadata()).format).toBe('webp');
    expect(createPlace.mock.calls[0][1]).toEqual({
      imageAltText: 'Lake view',
      uploadedImage: { objectKey: key, byteSize: stored.length, width: 4, height: 3 },
    });
  });

  it('rejects invalid image bytes before uploading or saving', async () => {
    await expect(service.create({
      name: 'Broken image', latitude: 21, longitude: 105, status: PlaceStatus.ACTIVE,
    }, { buffer: Buffer.from('not an image'), mimetype: 'image/png' })).rejects.toBeInstanceOf(InvalidPlaceImageException);

    expect(storage.put.mock.calls).toHaveLength(0);
    expect(createPlace).not.toHaveBeenCalled();
  });

  it('cleans up a newly uploaded image when updating the place fails', async () => {
    const existing = place();
    repository.findById.mockResolvedValue(existing);
    savePlace.mockRejectedValue(new Error('Save failed'));
    const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'navy' } }).png().toBuffer();

    await expect(service.update(existing.id, {}, { buffer, mimetype: 'image/png' })).rejects.toThrow('Save failed');
    expect(storage.delete.mock.calls).toEqual([[storage.put.mock.calls[0][0]]]);
  });

  it('reads storage only for an image linked to the requested place', async () => {
    const existing = place();
    repository.findImageObjectKey.mockResolvedValueOnce(null).mockResolvedValueOnce('places/test.webp');
    const data = Buffer.from('image');
    storage.get.mockResolvedValue(data);

    await expect(service.readImage(existing.id, 'unlinked')).rejects.toBeInstanceOf(PlaceImageNotFoundException);
    await expect(service.readImage(existing.id, 'linked')).resolves.toBe(data);
    expect(storage.get.mock.calls).toEqual([['places/test.webp']]);
  });

  it('requires latitude and longitude when creating', async () => {
    await expect(
      service.create({
        name: 'Incomplete coordinates',
        latitude: 21.0285,
        longitude: undefined as unknown as number,
        status: PlaceStatus.ACTIVE,
      }),
    ).rejects.toBeInstanceOf(CoordinatePairRequiredException);
    expect(createPlace).not.toHaveBeenCalled();
  });

  it('rejects a duplicate external provider identifier', async () => {
    repository.findByExternalProviderId.mockResolvedValue(place());

    await expect(
      service.create({
        name: 'Duplicate provider',
        latitude: 21.0285,
        longitude: 105.8542,
        externalProviderId: 'google-place-1',
        status: PlaceStatus.ACTIVE,
      }),
    ).rejects.toBeInstanceOf(ExternalProviderConflictException);
  });

  it('does not allow only one coordinate to be cleared', async () => {
    repository.findById.mockResolvedValue(place());

    await expect(
      service.update('11111111-1111-4111-8111-111111111111', {
        latitude: null,
      }),
    ).rejects.toBeInstanceOf(CoordinatePairRequiredException);
    expect(savePlace).not.toHaveBeenCalled();
  });

  it('does not allow both coordinates to be cleared', async () => {
    const existing = place();
    repository.findById.mockResolvedValue(existing);

    await expect(
      service.update(existing.id, {
        latitude: null as unknown as number,
        longitude: null as unknown as number,
      }),
    ).rejects.toBeInstanceOf(CoordinatePairRequiredException);
    expect(savePlace).not.toHaveBeenCalled();
  });

  it('rejects an empty update', async () => {
    await expect(
      service.update('11111111-1111-4111-8111-111111111111', {}),
    ).rejects.toBeInstanceOf(EmptyPlaceUpdateException);
  });
});
