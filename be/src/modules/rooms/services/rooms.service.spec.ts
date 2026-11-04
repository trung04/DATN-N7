import { AmenitiesService } from '../../amenities/services/amenities.service';
import { AmenityEntity } from '../../amenities/entities/amenity.entity';
import { RoomOperationalStatus, RoomEntity } from '../entities/room.entity';
import {
  EmptyRoomUpdateException,
  RoomNotFoundException,
  RoomNumberConflictException,
} from '../exceptions/room.exceptions';
import { RoomRepository } from '../interfaces/room.repository.interface';
import { RoomsService } from './rooms.service';

const room = (overrides: Partial<RoomEntity> = {}): RoomEntity =>
  Object.assign(new RoomEntity(), {
    id: '11111111-1111-4111-8111-111111111111',
    hotelId: '22222222-2222-4222-8222-222222222222',
    roomNumber: 'A101',
    maxOccupancy: 2,
    pricePerNight: 750000,
    currency: 'VND',
    description: null,
    operationalStatus: RoomOperationalStatus.AVAILABLE,
    roomType: 'DELUXE',
    createdAt: new Date('2026-11-03T00:00:00.000Z'),
    updatedAt: new Date('2026-11-03T00:00:00.000Z'),
    ...overrides,
  });

const amenity = (): AmenityEntity =>
  Object.assign(new AmenityEntity(), {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'FREE_WIFI',
    name: 'Free Wi-Fi',
    createdAt: new Date('2026-11-03T00:00:00.000Z'),
    updatedAt: new Date('2026-11-03T00:00:00.000Z'),
  });

describe('RoomsService', () => {
  let repository: jest.Mocked<RoomRepository>;
  let amenitiesService: jest.Mocked<Pick<AmenitiesService, 'findByIds'>>;
  let service: RoomsService;
  let createRoom: jest.MockedFunction<RoomRepository['create']>;
  let deleteRoom: jest.MockedFunction<RoomRepository['delete']>;

  beforeEach(() => {
    createRoom = jest.fn();
    deleteRoom = jest.fn();
    repository = {
      findById: jest.fn(),
      findByHotelAndNumber: jest.fn(),
      findPage: jest.fn(),
      create: createRoom,
      save: jest.fn(),
      delete: deleteRoom,
    };
    amenitiesService = { findByIds: jest.fn() };
    service = new RoomsService(
      repository,
      amenitiesService as unknown as AmenitiesService,
    );
  });

  it('creates a room with validated amenities', async () => {
    const saved = room();
    const wifi = amenity();
    repository.findByHotelAndNumber.mockResolvedValue(null);
    amenitiesService.findByIds.mockResolvedValue([wifi]);
    repository.create.mockResolvedValue({
      room: saved,
      amenityIds: [wifi.id],
    });

    await expect(
      service.create({
        hotelId: saved.hotelId,
        roomNumber: ' a101 ',
        maxOccupancy: 2,
        pricePerNight: 750000,
        currency: 'vnd',
        operationalStatus: RoomOperationalStatus.AVAILABLE,
        roomType: ' DELUXE ',
        amenityIds: [wifi.id],
      }),
    ).resolves.toEqual({ room: saved, amenities: [wifi] });
    expect(createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        roomNumber: 'A101',
        currency: 'VND',
        roomType: 'DELUXE',
      }),
      [wifi.id],
    );
  });

  it('rejects a duplicate room number in the same hotel', async () => {
    const existing = room();
    repository.findByHotelAndNumber.mockResolvedValue(existing);

    await expect(
      service.create({
        hotelId: existing.hotelId,
        roomNumber: existing.roomNumber,
        maxOccupancy: 2,
        pricePerNight: 750000,
        currency: 'VND',
        operationalStatus: RoomOperationalStatus.AVAILABLE,
        roomType: 'DELUXE',
        amenityIds: [],
      }),
    ).rejects.toBeInstanceOf(RoomNumberConflictException);
  });

  it('rejects an empty update', async () => {
    await expect(service.update(room().id, {})).rejects.toBeInstanceOf(
      EmptyRoomUpdateException,
    );
  });

  it('returns not found for an unknown room', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findById(room().id)).rejects.toBeInstanceOf(
      RoomNotFoundException,
    );
  });

  it('deletes a room and its owned amenity links', async () => {
    const existing = room();
    repository.findById.mockResolvedValue({ room: existing, amenityIds: [] });

    await service.delete(existing.id);

    expect(deleteRoom).toHaveBeenCalledWith(existing);
  });
});
