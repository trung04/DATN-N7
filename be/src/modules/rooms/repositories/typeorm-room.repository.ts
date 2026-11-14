import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { RoomAmenityEntity } from '../entities/room-amenity.entity';
import { RoomEntity, RoomOperationalStatus } from '../entities/room.entity';
import { RoomNumberConflictException } from '../exceptions/room.exceptions';
import type {
  CreateRoomData,
  FindRoomsOptions,
  RoomPage,
  RoomRepository,
  RoomWithAmenityIds,
} from '../interfaces/room.repository.interface';

@Injectable()
export class TypeOrmRoomRepository implements RoomRepository {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,
    @InjectRepository(RoomAmenityEntity)
    private readonly roomAmenityRepository: Repository<RoomAmenityEntity>,
    private readonly dataSource: DataSource,
  ) {}

  findBookableByHotel(hotelId?: string): Promise<RoomEntity[]> {
    return this.roomRepository.find({
      where: {
        ...(hotelId ? { hotelId } : {}),
        operationalStatus: RoomOperationalStatus.AVAILABLE,
      },
      order: { roomNumber: 'ASC', id: 'ASC' },
    });
  }

  async findById(id: string): Promise<RoomWithAmenityIds | null> {
    const room = await this.roomRepository.findOneBy({ id });
    if (!room) return null;
    const amenityIds = await this.findAmenityIds([id]);
    return { room, amenityIds: amenityIds.get(id) ?? [] };
  }

  findByIds(ids: string[]): Promise<RoomEntity[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.roomRepository.find({
      where: { id: In(ids) },
      order: { id: 'ASC' },
    });
  }

  findByHotelAndNumber(
    hotelId: string,
    roomNumber: string,
  ): Promise<RoomEntity | null> {
    return this.roomRepository.findOneBy({ hotelId, roomNumber });
  }

  async findPage(options: FindRoomsOptions): Promise<RoomPage> {
    const query = this.roomRepository.createQueryBuilder('room');

    if (options.search) {
      const escapedSearch = options.search.replace(/[\\%_]/g, '\\$&');
      query.andWhere(
        "(room.roomNumber ILIKE :search ESCAPE '\\' OR room.roomType ILIKE :search ESCAPE '\\')",
        { search: `%${escapedSearch}%` },
      );
    }
    if (options.hotelId) {
      query.andWhere('room.hotelId = :hotelId', { hotelId: options.hotelId });
    }
    if (options.roomType) {
      query.andWhere('LOWER(room.roomType) = LOWER(:roomType)', {
        roomType: options.roomType,
      });
    }
    if (options.operationalStatus) {
      query.andWhere('room.operationalStatus = :operationalStatus', {
        operationalStatus: options.operationalStatus,
      });
    }

    const sortColumns: Record<FindRoomsOptions['sortBy'], string> = {
      roomNumber: 'room.roomNumber',
      maxOccupancy: 'room.maxOccupancy',
      pricePerNight: 'room.pricePerNight',
      createdAt: 'room.createdAt',
      updatedAt: 'room.updatedAt',
    };

    const [rooms, total] = await query
      .orderBy(sortColumns[options.sortBy], options.sortOrder)
      .addOrderBy('room.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();

    const amenityIdsByRoom = await this.findAmenityIds(
      rooms.map((room) => room.id),
    );
    return {
      items: rooms.map((room) => ({
        room,
        amenityIds: amenityIdsByRoom.get(room.id) ?? [],
      })),
      total,
    };
  }

  async create(
    data: CreateRoomData,
    amenityIds: string[],
  ): Promise<RoomWithAmenityIds> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(RoomEntity);
        const room = await repository.save(repository.create(data));
        await this.replaceAmenities(manager, room.id, amenityIds);
        return { room, amenityIds };
      });
    } catch (error) {
      this.rethrowRoomNumberConflict(error, data.hotelId, data.roomNumber);
    }
  }

  async save(
    room: RoomEntity,
    amenityIds?: string[],
  ): Promise<RoomWithAmenityIds> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const savedRoom = await manager.getRepository(RoomEntity).save(room);
        let resolvedAmenityIds = amenityIds;
        if (resolvedAmenityIds !== undefined) {
          await this.replaceAmenities(manager, room.id, resolvedAmenityIds);
        } else {
          const links = await manager.getRepository(RoomAmenityEntity).findBy({
            roomId: room.id,
          });
          resolvedAmenityIds = links.map((link) => link.amenityId);
        }
        return { room: savedRoom, amenityIds: resolvedAmenityIds };
      });
    } catch (error) {
      this.rethrowRoomNumberConflict(error, room.hotelId, room.roomNumber);
    }
  }

  async delete(room: RoomEntity): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(RoomAmenityEntity).softDelete({
        roomId: room.id,
        deletedAt: IsNull(),
      });
      await manager.getRepository(RoomEntity).softRemove(room);
    });
  }

  private async findAmenityIds(
    roomIds: string[],
  ): Promise<Map<string, string[]>> {
    if (roomIds.length === 0) return new Map();
    const links = await this.roomAmenityRepository.find({
      where: { roomId: In(roomIds) },
      order: { amenityId: 'ASC' },
    });
    const result = new Map<string, string[]>();
    for (const link of links) {
      const ids = result.get(link.roomId) ?? [];
      ids.push(link.amenityId);
      result.set(link.roomId, ids);
    }
    return result;
  }

  private async replaceAmenities(
    manager: EntityManager,
    roomId: string,
    amenityIds: string[],
  ): Promise<void> {
    const repository = manager.getRepository(RoomAmenityEntity);
    await repository.softDelete({ roomId, deletedAt: IsNull() });
    if (amenityIds.length > 0) {
      await repository.insert(
        amenityIds.map((amenityId) => ({ roomId, amenityId })),
      );
    }
  }

  private rethrowRoomNumberConflict(
    error: unknown,
    hotelId: string,
    roomNumber: string,
  ): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      throw new RoomNumberConflictException(hotelId, roomNumber);
    }
    throw error;
  }
}
