import { PlaceEntity, PlaceStatus } from '../entities/place.entity';
import {
  CoordinatePairRequiredException,
  EmptyPlaceUpdateException,
  ExternalProviderConflictException,
} from '../exceptions/place.exceptions';
import type { PlaceRepository } from '../interfaces/place.repository.interface';
import { PlacesService } from './places.service';

const place = (overrides: Partial<PlaceEntity> = {}): PlaceEntity =>
  Object.assign(new PlaceEntity(), {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Hoan Kiem Lake',
    description: null,
    address: 'Hoan Kiem, Hanoi',
    countryCode: 'VN',
    provinceCode: 'HN',
    timezone: 'Asia/Ho_Chi_Minh',
    latitude: 21.0285,
    longitude: 105.8542,
    status: PlaceStatus.ACTIVE,
    averageRating: 0,
    externalProviderId: null,
    openingTime: null,
    ...overrides,
  });

describe('PlacesService', () => {
  let repository: jest.Mocked<PlaceRepository>;
  let service: PlacesService;
  let createPlace: jest.MockedFunction<PlaceRepository['create']>;
  let savePlace: jest.MockedFunction<PlaceRepository['save']>;

  beforeEach(() => {
    createPlace = jest.fn();
    savePlace = jest.fn();
    repository = {
      findById: jest.fn(),
      findByExternalProviderId: jest.fn(),
      findPage: jest.fn(),
      create: createPlace,
      save: savePlace,
      delete: jest.fn(),
    };
    service = new PlacesService(repository);
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
    );
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
