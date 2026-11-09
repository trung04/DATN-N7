import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { HotelOwnerEntity } from '../../users/entities/hotel-owner.entity';
import {
  HotelOwnerConflictException,
  HotelOwnerUserReferenceException,
} from '../exceptions/hotel-owner.exceptions';
import type {
  CreateHotelOwnerData,
  FindHotelOwnersOptions,
  HotelOwnerPage,
  HotelOwnerRepository,
} from '../interfaces/hotel-owner.repository.interface';

@Injectable()
export class TypeOrmHotelOwnerRepository implements HotelOwnerRepository {
  constructor(
    @InjectRepository(HotelOwnerEntity)
    private readonly repository: Repository<HotelOwnerEntity>,
  ) {}

  findByUserId(userId: string): Promise<HotelOwnerEntity | null> {
    return this.repository.findOneBy({ userId });
  }

  async findPage(options: FindHotelOwnersOptions): Promise<HotelOwnerPage> {
    const query = this.repository.createQueryBuilder('hotelOwner');

    if (options.search) {
      const escapedSearch = options.search.replace(/[\\%_]/g, '\\$&');
      query.andWhere(
        `(hotelOwner.bankName ILIKE :search ESCAPE '\\'
          OR hotelOwner.bankAccountNumber ILIKE :search ESCAPE '\\'
          OR hotelOwner.bankAccountHolder ILIKE :search ESCAPE '\\')`,
        { search: `%${escapedSearch}%` },
      );
    }
    if (options.userId) {
      query.andWhere('hotelOwner.userId = :userId', {
        userId: options.userId,
      });
    }

    const sortColumns: Record<FindHotelOwnersOptions['sortBy'], string> = {
      userId: 'hotelOwner.userId',
      bankName: 'hotelOwner.bankName',
      bankAccountHolder: 'hotelOwner.bankAccountHolder',
    };

    const [items, total] = await query
      .orderBy(sortColumns[options.sortBy], options.sortOrder, 'NULLS LAST')
      .addOrderBy('hotelOwner.userId', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
    return { items, total };
  }

  async create(data: CreateHotelOwnerData): Promise<HotelOwnerEntity> {
    try {
      const deleted = await this.repository.findOne({
        where: { userId: data.userId },
        withDeleted: true,
      });
      if (deleted?.deletedAt) {
        Object.assign(deleted, data, { deletedAt: null });
        return await this.repository.save(deleted);
      }
      return await this.repository.save(this.repository.create(data));
    } catch (error) {
      this.rethrowPersistenceConflict(error, data.userId);
    }
  }

  save(hotelOwner: HotelOwnerEntity): Promise<HotelOwnerEntity> {
    return this.repository.save(hotelOwner);
  }

  async delete(hotelOwner: HotelOwnerEntity): Promise<void> {
    await this.repository.softRemove(hotelOwner);
  }

  private rethrowPersistenceConflict(error: unknown, userId: string): never {
    if (error instanceof QueryFailedError) {
      const code = (error.driverError as { code?: string }).code;
      if (code === '23505') throw new HotelOwnerConflictException(userId);
      if (code === '23503') {
        throw new HotelOwnerUserReferenceException(userId);
      }
    }
    throw error;
  }
}
