import { AmenityEntity } from '../entities/amenity.entity';
import {
  AmenityCodeConflictException,
  AmenityNotFoundException,
  EmptyAmenityUpdateException,
} from '../exceptions/amenity.exceptions';
import { AmenityRepository } from '../interfaces/amenity.repository.interface';
import { AmenitiesService } from './amenities.service';

const amenity = (overrides: Partial<AmenityEntity> = {}): AmenityEntity =>
  Object.assign(new AmenityEntity(), {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'FREE_WIFI',
    name: 'Free Wi-Fi',
    createdAt: new Date('2026-11-03T00:00:00.000Z'),
    updatedAt: new Date('2026-11-03T00:00:00.000Z'),
    ...overrides,
  });

describe('AmenitiesService', () => {
  let repository: jest.Mocked<AmenityRepository>;
  let service: AmenitiesService;
  let createAmenity: jest.MockedFunction<AmenityRepository['create']>;
  let deleteAmenity: jest.MockedFunction<AmenityRepository['delete']>;

  beforeEach(() => {
    createAmenity = jest.fn();
    deleteAmenity = jest.fn();
    repository = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findPage: jest.fn(),
      create: createAmenity,
      save: jest.fn(),
      delete: deleteAmenity,
    };
    service = new AmenitiesService(repository);
  });

  it('normalizes the code when creating an amenity', async () => {
    const saved = amenity();
    repository.findByCode.mockResolvedValue(null);
    repository.create.mockResolvedValue(saved);

    await expect(
      service.create({
        code: ' free_wifi ',
        name: ' Free Wi-Fi ',
      }),
    ).resolves.toBe(saved);
    expect(createAmenity).toHaveBeenCalledWith({
      code: 'FREE_WIFI',
      name: 'Free Wi-Fi',
    });
  });

  it('rejects a duplicate code', async () => {
    repository.findByCode.mockResolvedValue(amenity());

    await expect(
      service.create({ code: 'FREE_WIFI', name: 'Wi-Fi' }),
    ).rejects.toBeInstanceOf(AmenityCodeConflictException);
    expect(createAmenity).not.toHaveBeenCalled();
  });

  it('rejects an empty update', async () => {
    await expect(service.update(amenity().id, {})).rejects.toBeInstanceOf(
      EmptyAmenityUpdateException,
    );
  });

  it('returns not found for an unknown amenity', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findById(amenity().id)).rejects.toBeInstanceOf(
      AmenityNotFoundException,
    );
  });

  it('deletes an existing amenity', async () => {
    const existing = amenity();
    repository.findById.mockResolvedValue(existing);

    await service.delete(existing.id);

    expect(deleteAmenity).toHaveBeenCalledWith(existing);
  });
});
