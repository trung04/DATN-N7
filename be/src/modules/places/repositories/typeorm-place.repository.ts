import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PlaceEntity } from '../entities/place.entity';
import { ExternalProviderConflictException } from '../exceptions/place.exceptions';
import type {
  CreatePlaceData,
  FindPlacesOptions,
  PlacePage,
  PlaceRepository,
} from '../interfaces/place.repository.interface';

@Injectable()
export class TypeOrmPlaceRepository implements PlaceRepository {
  constructor(
    @InjectRepository(PlaceEntity)
    private readonly repository: Repository<PlaceEntity>,
  ) {}

  findById(id: string): Promise<PlaceEntity | null> {
    return this.repository.findOneBy({ id });
  }

  findByExternalProviderId(
    externalProviderId: string,
  ): Promise<PlaceEntity | null> {
    return this.repository.findOneBy({ externalProviderId });
  }

  async findPage(options: FindPlacesOptions): Promise<PlacePage> {
    const query = this.repository.createQueryBuilder('place');

    if (options.search) {
      query.andWhere(
        `to_tsvector('simple', "place"."search_document")
          @@ websearch_to_tsquery('simple', :search)`,
        { search: options.search },
      );
    }
    if (options.status) {
      query.andWhere('place.status = :status', { status: options.status });
    }
    if (options.countryCode) {
      query.andWhere('place.countryCode = :countryCode', {
        countryCode: options.countryCode,
      });
    }
    if (options.provinceCode) {
      query.andWhere('place.provinceCode = :provinceCode', {
        provinceCode: options.provinceCode,
      });
    }
    if (options.minRating !== undefined) {
      query.andWhere('place.averageRating >= :minRating', {
        minRating: options.minRating,
      });
    }

    const sortColumns: Record<FindPlacesOptions['sortBy'], string> = {
      name: 'place.name',
      averageRating: 'place.averageRating',
      status: 'place.status',
    };

    const [items, total] = await query
      .orderBy(sortColumns[options.sortBy], options.sortOrder)
      .addOrderBy('place.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
    return { items, total };
  }

  async create(data: CreatePlaceData): Promise<PlaceEntity> {
    try {
      return await this.repository.save(this.repository.create(data));
    } catch (error) {
      this.rethrowProviderConflict(error);
    }
  }

  async save(place: PlaceEntity): Promise<PlaceEntity> {
    try {
      return await this.repository.save(place);
    } catch (error) {
      this.rethrowProviderConflict(error);
    }
  }

  async delete(place: PlaceEntity): Promise<void> {
    await this.repository.remove(place);
  }

  private rethrowProviderConflict(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      throw new ExternalProviderConflictException();
    }
    throw error;
  }
}
