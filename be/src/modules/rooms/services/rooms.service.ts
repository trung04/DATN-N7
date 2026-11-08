import { Inject, Injectable } from '@nestjs/common';
import { AmenitiesService } from '../../amenities/services/amenities.service';
import { HotelsService } from '../../hotels/services/hotels.service';
import { CreateRoomRequest } from '../dtos/requests/create-room.request';
import { ListRoomsRequest } from '../dtos/requests/list-rooms.request';
import { UpdateRoomRequest } from '../dtos/requests/update-room.request';
import { RoomEntity } from '../entities/room.entity';
import {
  EmptyRoomUpdateException,
  RoomNotFoundException,
  RoomNumberConflictException,
} from '../exceptions/room.exceptions';
import { ROOM_REPOSITORY } from '../interfaces/room.repository.interface';
import type { RoomRepository } from '../interfaces/room.repository.interface';
import type {
  RoomResultPage,
  RoomWithAmenities,
} from '../interfaces/room-result.interface';

@Injectable()
export class RoomsService {
  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly repository: RoomRepository,
    private readonly amenitiesService: AmenitiesService,
    private readonly hotelsService: HotelsService,
  ) {}

  async create(input: CreateRoomRequest): Promise<RoomWithAmenities> {
    await this.hotelsService.assertActive(input.hotelId);
    const roomNumber = this.normalizeRoomNumber(input.roomNumber);
    if (await this.repository.findByHotelAndNumber(input.hotelId, roomNumber)) {
      throw new RoomNumberConflictException(input.hotelId, roomNumber);
    }

    const amenities = await this.amenitiesService.findByIds(input.amenityIds);
    const result = await this.repository.create(
      {
        hotelId: input.hotelId,
        roomNumber,
        maxOccupancy: input.maxOccupancy,
        pricePerNight: input.pricePerNight,
        currency: input.currency.trim().toUpperCase(),
        description: input.description?.trim() || null,
        operationalStatus: input.operationalStatus,
        roomType: input.roomType.trim(),
      },
      input.amenityIds,
    );
    return { room: result.room, amenities };
  }

  async findPage(input: ListRoomsRequest): Promise<RoomResultPage> {
    const page = await this.repository.findPage({
      page: input.page,
      limit: input.limit,
      search: input.search,
      hotelId: input.hotelId,
      roomType: input.roomType,
      operationalStatus: input.operationalStatus,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
    const amenityIds = [
      ...new Set(page.items.flatMap((item) => item.amenityIds)),
    ];
    const amenities = await this.amenitiesService.findByIds(amenityIds);
    const amenitiesById = new Map(
      amenities.map((amenity) => [amenity.id, amenity]),
    );

    return {
      items: page.items.map((item) => ({
        room: item.room,
        amenities: item.amenityIds.map((id) => amenitiesById.get(id)!),
      })),
      total: page.total,
    };
  }

  async findById(id: string): Promise<RoomWithAmenities> {
    const result = await this.repository.findById(id);
    if (!result) throw new RoomNotFoundException(id);
    const amenities = await this.amenitiesService.findByIds(result.amenityIds);
    return { room: result.room, amenities };
  }

  async findEntitiesByIds(ids: string[]): Promise<RoomEntity[]> {
    const uniqueIds = [...new Set(ids)];
    const rooms = await this.repository.findByIds(uniqueIds);
    const roomsById = new Map(rooms.map((room) => [room.id, room]));
    for (const id of uniqueIds) {
      if (!roomsById.has(id)) throw new RoomNotFoundException(id);
    }
    return uniqueIds.map((id) => roomsById.get(id)!);
  }

  async update(
    id: string,
    input: UpdateRoomRequest,
  ): Promise<RoomWithAmenities> {
    if (this.isEmptyUpdate(input)) throw new EmptyRoomUpdateException();

    const current = await this.repository.findById(id);
    if (!current) throw new RoomNotFoundException(id);
    const room = current.room;
    const hotelId = input.hotelId ?? room.hotelId;
    if (hotelId !== room.hotelId) {
      await this.hotelsService.assertActive(hotelId);
    }
    const roomNumber =
      input.roomNumber === undefined
        ? room.roomNumber
        : this.normalizeRoomNumber(input.roomNumber);

    if (hotelId !== room.hotelId || roomNumber !== room.roomNumber) {
      const duplicate = await this.repository.findByHotelAndNumber(
        hotelId,
        roomNumber,
      );
      if (duplicate && duplicate.id !== room.id) {
        throw new RoomNumberConflictException(hotelId, roomNumber);
      }
    }

    const targetAmenityIds = input.amenityIds ?? current.amenityIds;
    const amenities = await this.amenitiesService.findByIds(targetAmenityIds);
    this.applyUpdate(room, input, hotelId, roomNumber);
    const saved = await this.repository.save(room, input.amenityIds);
    return { room: saved.room, amenities };
  }

  async delete(id: string): Promise<void> {
    const result = await this.repository.findById(id);
    if (!result) throw new RoomNotFoundException(id);
    await this.repository.delete(result.room);
  }

  private applyUpdate(
    room: RoomEntity,
    input: UpdateRoomRequest,
    hotelId: string,
    roomNumber: string,
  ): void {
    room.hotelId = hotelId;
    room.roomNumber = roomNumber;
    if (input.maxOccupancy !== undefined)
      room.maxOccupancy = input.maxOccupancy;
    if (input.pricePerNight !== undefined)
      room.pricePerNight = input.pricePerNight;
    if (input.currency !== undefined)
      room.currency = input.currency.trim().toUpperCase();
    if (input.description !== undefined) {
      room.description = input.description?.trim() || null;
    }
    if (input.operationalStatus !== undefined)
      room.operationalStatus = input.operationalStatus;
    if (input.roomType !== undefined) room.roomType = input.roomType.trim();
  }

  private isEmptyUpdate(input: UpdateRoomRequest): boolean {
    return [
      input.hotelId,
      input.roomNumber,
      input.maxOccupancy,
      input.pricePerNight,
      input.currency,
      input.description,
      input.operationalStatus,
      input.roomType,
      input.amenityIds,
    ].every((value) => value === undefined);
  }

  private normalizeRoomNumber(roomNumber: string): string {
    return roomNumber.trim().toUpperCase();
  }
}
