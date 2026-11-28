import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { HotelDocumentEntity } from '../entities/hotel-document.entity';
import { HotelReviewHistoryEntity } from '../entities/hotel-review-history.entity';
import { HotelEntity } from '../entities/hotel.entity';
import {
  HotelReferenceException,
  HotelNotFoundException,
  HotelTaxCodeConflictException,
} from '../exceptions/hotel.exceptions';
import type {
  CreateHotelData,
  CreateHotelDocumentData,
  CreateHotelReviewData,
  FindHotelsOptions,
  HotelPage,
  HotelRepository,
} from '../interfaces/hotel.repository.interface';

@Injectable()
export class TypeOrmHotelRepository implements HotelRepository {
  constructor(
    @InjectRepository(HotelEntity)
    private readonly repository: Repository<HotelEntity>,
    @InjectRepository(HotelDocumentEntity)
    private readonly documentRepository: Repository<HotelDocumentEntity>,
    @InjectRepository(HotelReviewHistoryEntity)
    private readonly reviewRepository: Repository<HotelReviewHistoryEntity>,
  ) {}

  async findIdsByOwner(ownerUserId: string): Promise<string[]> {
    const hotels = await this.repository.find({
      select: { id: true }, where: { ownerUserId }, order: { id: 'ASC' },
    });
    return hotels.map((hotel) => hotel.id);
  }

  findById(id: string): Promise<HotelEntity | null> {
    return this.findDetailed(this.repository, id);
  }

  private findDetailed(
    repository: Repository<HotelEntity>,
    id: string,
  ): Promise<HotelEntity | null> {
    return repository.findOne({
      where: { id },
      relations: { documents: true, images: { image: true } },
      order: {
        documents: { createdAt: 'ASC' },
        images: { imageOrder: 'ASC', id: 'ASC' },
      },
    });
  }

  findByTaxCode(taxCode: string): Promise<HotelEntity | null> {
    return this.repository.findOneBy({ taxCode });
  }

  async findPage(options: FindHotelsOptions): Promise<HotelPage> {
    const query = this.repository.createQueryBuilder('hotel');

    if (options.search) {
      const escapedSearch = options.search.replace(/[\\%_]/g, '\\$&');
      query.andWhere(
        `(hotel.name ILIKE :search ESCAPE '\\'
          OR hotel.legalName ILIKE :search ESCAPE '\\'
          OR hotel.taxCode ILIKE :search ESCAPE '\\')`,
        { search: `%${escapedSearch}%` },
      );
    }
    if (options.ownerUserId) {
      query.andWhere('hotel.ownerUserId = :ownerUserId', {
        ownerUserId: options.ownerUserId,
      });
    }
    if (options.placeId) {
      query.andWhere('hotel.placeId = :placeId', { placeId: options.placeId });
    }
    if (options.status) {
      query.andWhere('hotel.status = :status', { status: options.status });
    }
    if (options.excludedStatus) {
      query.andWhere('hotel.status <> :excludedStatus', {
        excludedStatus: options.excludedStatus,
      });
    }

    const sortColumns: Record<FindHotelsOptions['sortBy'], string> = {
      createdAt: 'hotel.createdAt',
      name: 'hotel.name',
      status: 'hotel.status',
    };
    const [items, total] = await query
      .orderBy(sortColumns[options.sortBy], options.sortOrder)
      .addOrderBy('hotel.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
    if (!items.length) return { items, total };
    // Paginate hotels before loading their collections: one hotel with many
    // images or documents must not consume several positions on a page.
    const detailed = await this.repository.find({
      where: { id: In(items.map((hotel) => hotel.id)) },
      relations: { documents: true, images: { image: true } },
      relationLoadStrategy: 'query',
      order: {
        documents: { createdAt: 'ASC' },
        images: { imageOrder: 'ASC', id: 'ASC' },
      },
    });
    const byId = new Map(detailed.map((hotel) => [hotel.id, hotel]));
    return { items: items.map((hotel) => byId.get(hotel.id)!), total };
  }

  async create(data: CreateHotelData): Promise<HotelEntity> {
    try {
      const hotel = await this.repository.save(this.repository.create(data));
      hotel.documents = [];
      return hotel;
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async save(hotel: HotelEntity): Promise<HotelEntity> {
    try {
      await this.repository.save(hotel);
      return (await this.findById(hotel.id))!;
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async saveWithReview(
    hotel: HotelEntity,
    review: CreateHotelReviewData,
    validate?: (current: HotelEntity) => void,
  ): Promise<HotelEntity> {
    try {
      return await this.repository.manager.transaction(async (manager) => {
        const hotels = manager.getRepository(HotelEntity);
        if (validate) {
          await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
            `hotel-images:${hotel.id}`,
          ]);
          const locked = await hotels.findOne({
            where: { id: hotel.id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!locked) throw new HotelNotFoundException(hotel.id);
          const current = await this.findDetailed(hotels, hotel.id);
          if (!current) throw new HotelNotFoundException(hotel.id);
          validate(current);
          await hotels.update(hotel.id, {
            status: hotel.status,
            submittedAt: hotel.submittedAt,
            reviewedAt: hotel.reviewedAt,
            reviewedBy: hotel.reviewedBy,
            rejectionReason: hotel.rejectionReason,
          });
        } else {
          await hotels.save(hotel);
        }
        await manager
          .getRepository(HotelReviewHistoryEntity)
          .save(manager.getRepository(HotelReviewHistoryEntity).create(review));
        return (await this.findDetailed(hotels, hotel.id))!;
      });
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async createDocument(
    data: CreateHotelDocumentData,
  ): Promise<HotelDocumentEntity> {
    try {
      return await this.documentRepository.save(
        this.documentRepository.create(data),
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  findDocumentById(id: string): Promise<HotelDocumentEntity | null> {
    return this.documentRepository.findOneBy({ id });
  }

  async deleteDocument(document: HotelDocumentEntity): Promise<void> {
    await this.documentRepository.remove(document);
  }

  findReviewHistory(hotelId: string): Promise<HotelReviewHistoryEntity[]> {
    return this.reviewRepository.find({
      where: { hotelId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  private rethrowPersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as {
        code?: string;
        constraint?: string;
      };
      if (
        driverError.code === '23505' &&
        driverError.constraint === 'UQ_hotels_tax_code'
      ) {
        throw new HotelTaxCodeConflictException();
      }
      if (driverError.code === '23503') {
        if (
          driverError.constraint ===
          'FK_hotels_owner_user_id_hotel_owners_user_id'
        ) {
          throw new HotelReferenceException('owner');
        }
        if (driverError.constraint === 'FK_hotels_place_id_places_id') {
          throw new HotelReferenceException('place');
        }
        if (
          driverError.constraint ===
          'FK_hotel_review_histories_actor_user_id_users_id'
        ) {
          throw new HotelReferenceException('reviewer');
        }
      }
    }
    throw error;
  }
}
