import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AmenitiesService } from '../../amenities/services/amenities.service';
import { HotelsService } from '../../hotels/services/hotels.service';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import { UserRole } from '../../users/entities/user.entity';
import { CreateRoomRequest } from '../dtos/requests/create-room.request';
import { ListRoomsRequest } from '../dtos/requests/list-rooms.request';
import { UpdateRoomRequest } from '../dtos/requests/update-room.request';
import { RoomEntity } from '../entities/room.entity';
import { RoomGuestPolicyEntity } from '../entities/room-guest-policy.entity';
import { UpsertRoomGuestPolicyRequest } from '../dtos/requests/upsert-room-guest-policy.request';
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
    @Optional()
    @InjectRepository(RoomGuestPolicyEntity)
    private readonly guestPolicyRepository?: Repository<RoomGuestPolicyEntity>,
  ) {}

  async create(
    input: CreateRoomRequest,
    actor: AuthorizationActor,
  ): Promise<RoomWithAmenities> {
    await this.hotelsService.assertManagedBy(input.hotelId, actor);
    await this.hotelsService.assertActive(input.hotelId);
    const roomNumber = this.normalizeRoomNumber(input.roomNumber);
    if (await this.repository.findByHotelAndNumber(input.hotelId, roomNumber)) {
      throw new RoomNumberConflictException(input.hotelId, roomNumber);
    }

    const amenities = await this.amenitiesService.findByIdsForHotel(
      input.amenityIds,
      input.hotelId,
    );
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
    await this.ensureDefaultGuestPolicy(result.room);
    return { room: result.room, amenities };
  }

  async listGuestPolicies(
    hotelId?: string,
    hotelIds?: string[],
  ): Promise<RoomGuestPolicyEntity[]> {
    const requestedHotelIds = hotelId ? [hotelId] : hotelIds ?? [];
    if (requestedHotelIds.length === 0) return [];
    return this.requireGuestPolicyRepository().find({
      where: { hotelId: In(requestedHotelIds) },
      order: { roomType: 'ASC' },
    });
  }

  async saveGuestPolicy(
    input: UpsertRoomGuestPolicyRequest,
    actor: AuthorizationActor,
  ): Promise<RoomGuestPolicyEntity> {
    await this.hotelsService.assertManagedBy(input.hotelId, actor);
    await this.hotelsService.assertActive(input.hotelId);
    const roomType = this.normalizeRoomType(input.roomType);
    const repository = this.requireGuestPolicyRepository();
    const roomTypes = (await repository.manager.query(
      `SELECT max(max_occupancy) AS "maxOccupancy" FROM rooms
       WHERE hotel_id = $1::uuid AND deleted_at IS NULL
         AND lower(btrim(room_type)) = lower(btrim($2))`,
      [input.hotelId, roomType],
    )) as Array<{ maxOccupancy: number | string | null }>;
    const maximumOccupancy = Number(roomTypes[0]?.maxOccupancy ?? 0);
    if (!maximumOccupancy) {
      throw new BadRequestException('Room type must exist in this hotel before its guest policy can be configured.');
    }
    if (input.maxAdults > maximumOccupancy) {
      throw new BadRequestException(`Maximum adults cannot exceed this room type's largest room capacity (${maximumOccupancy}).`);
    }
    if (input.freeChildMaxAge >= 12) {
      throw new BadRequestException('Children aged 12 and above must be counted as adults.');
    }
    const current = await repository
      .createQueryBuilder('policy')
      .where('policy.hotelId = :hotelId', { hotelId: input.hotelId })
      .andWhere('LOWER(BTRIM(policy.roomType)) = LOWER(BTRIM(:roomType))', { roomType })
      .getOne();
    const policy = current ?? repository.create({ hotelId: input.hotelId, roomType });
    policy.roomType = roomType;
    policy.maxAdults = input.maxAdults;
    policy.maxChildren = input.maxChildren;
    policy.adultAgeFrom = 12;
    policy.freeChildMaxAge = input.freeChildMaxAge;
    policy.childSurchargePerNight = input.childSurchargePerNight;
    return repository.save(policy);
  }

  private async ensureDefaultGuestPolicy(room: RoomEntity): Promise<void> {
    if (!this.guestPolicyRepository) return;
    const current = await this.guestPolicyRepository
      .createQueryBuilder('policy')
      .where('policy.hotelId = :hotelId', { hotelId: room.hotelId })
      .andWhere('LOWER(BTRIM(policy.roomType)) = LOWER(BTRIM(:roomType))', {
        roomType: room.roomType,
      })
      .getOne();
    if (current) return;
    await this.guestPolicyRepository.save(
      this.guestPolicyRepository.create({
        hotelId: room.hotelId,
        roomType: this.normalizeRoomType(room.roomType),
        maxAdults: room.maxOccupancy,
        maxChildren: room.maxOccupancy,
        adultAgeFrom: 12,
        freeChildMaxAge: 11,
        childSurchargePerNight: 0,
      }),
    );
  }

  private requireGuestPolicyRepository(): Repository<RoomGuestPolicyEntity> {
    if (!this.guestPolicyRepository) {
      throw new Error('Room guest policy repository is not configured.');
    }
    return this.guestPolicyRepository;
  }

  private normalizeRoomType(roomType: string): string {
    return roomType.trim().replace(/\s+/g, ' ');
  }

  async findManagedPage(input: ListRoomsRequest, actor: AuthorizationActor): Promise<RoomResultPage> {
    if (actor.role !== UserRole.HOTEL_OWNER && actor.role !== UserRole.ADMIN) {
      throw new AuthorizationDeniedException();
    }
    if (input.hotelId) await this.hotelsService.assertManagedBy(input.hotelId, actor);
    const hotelIds = actor.role === UserRole.HOTEL_OWNER
      ? await this.hotelsService.findOwnedIds(actor.id)
      : undefined;
    return this.findPage(input, hotelIds);
  }

  async findPage(input: ListRoomsRequest, hotelIds?: string[]): Promise<RoomResultPage> {
    const page = await this.repository.findPage({
      page: input.page,
      limit: input.limit,
      search: input.search,
      hotelId: input.hotelId,
      hotelIds,
      roomType: input.roomType,
      operationalStatus: input.operationalStatus,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
    const amenityIds = [
      ...new Set(page.items.flatMap((item) => item.amenityIds)),
    ];
    const amenities = await this.amenitiesService.findExistingByIds(amenityIds);
    const amenitiesById = new Map(
      amenities.map((amenity) => [amenity.id, amenity]),
    );

    return {
      items: page.items.map((item) => ({
        room: item.room,
        amenities: item.amenityIds.map((id) => amenitiesById.get(id)!),
        roomImageId: item.roomImageId ?? null,
      })),
      total: page.total,
    };
  }

  async findById(id: string): Promise<RoomWithAmenities> {
    const result = await this.repository.findById(id);
    if (!result) throw new RoomNotFoundException(id);
    const amenities = await this.amenitiesService.findExistingByIds(
      result.amenityIds,
    );
    return {
      room: result.room,
      amenities,
      roomImageId: result.roomImageId ?? null,
    };
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

  findBookableByHotel(hotelId?: string): Promise<RoomEntity[]> {
    return this.repository.findBookableByHotel(hotelId);
  }

  async update(
    id: string,
    input: UpdateRoomRequest,
    actor: AuthorizationActor,
  ): Promise<RoomWithAmenities> {
    if (this.isEmptyUpdate(input)) throw new EmptyRoomUpdateException();

    const current = await this.repository.findById(id);
    if (!current) throw new RoomNotFoundException(id);
    const room = current.room;
    await this.hotelsService.assertManagedBy(room.hotelId, actor, {
      requiresActiveHotel: true,
    });
    const hotelId = input.hotelId ?? room.hotelId;
    if (hotelId !== room.hotelId) {
      await this.hotelsService.assertManagedBy(hotelId, actor);
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
    const amenities = await this.amenitiesService.findByIdsForHotel(
      targetAmenityIds,
      hotelId,
    );
    this.applyUpdate(room, input, hotelId, roomNumber);
    const saved = await this.repository.save(room, input.amenityIds);
    await this.ensureDefaultGuestPolicy(saved.room);
    return { room: saved.room, amenities };
  }

  async delete(id: string, actor: AuthorizationActor): Promise<void> {
    const result = await this.repository.findById(id);
    if (!result) throw new RoomNotFoundException(id);
    await this.hotelsService.assertManagedBy(result.room.hotelId, actor, {
      requiresActiveHotel: true,
    });
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
