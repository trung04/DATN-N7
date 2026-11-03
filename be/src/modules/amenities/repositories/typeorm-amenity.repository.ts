import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AmenityEntity } from '../entities/amenity.entity';
import { AmenityCodeConflictException } from '../exceptions/amenity.exceptions';
import {
  AmenityPage,
  AmenityRepository,
  CreateAmenityData,
  FindAmenitiesOptions,
} from '../interfaces/amenity.repository.interface';

@Injectable()
export class TypeOrmAmenityRepository implements AmenityRepository {
  constructor(
    @InjectRepository(AmenityEntity)
    private readonly repository: Repository<AmenityEntity>,
  ) {}

  findById(id: string): Promise<AmenityEntity | null> {
    return this.repository.findOneBy({ id });
  }

  findByCode(code: string): Promise<AmenityEntity | null> {
    return this.repository.findOneBy({ code });
  }

  async findPage(options: FindAmenitiesOptions): Promise<AmenityPage> {
    const query = this.repository.createQueryBuilder('amenity');

    if (options.search) {
      const escapedSearch = options.search.replace(/[\\%_]/g, '\\$&');
      query.andWhere(
        "(amenity.code ILIKE :search ESCAPE '\\' OR amenity.name ILIKE :search ESCAPE '\\')",
        { search: `%${escapedSearch}%` },
      );
    }

    const sortColumns: Record<FindAmenitiesOptions['sortBy'], string> = {
      code: 'amenity.code',
      name: 'amenity.name',
      createdAt: 'amenity.createdAt',
      updatedAt: 'amenity.updatedAt',
    };

    const [items, total] = await query
      .orderBy(sortColumns[options.sortBy], options.sortOrder)
      .addOrderBy('amenity.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();

    return { items, total };
  }

  async create(data: CreateAmenityData): Promise<AmenityEntity> {
    try {
      return await this.repository.save(this.repository.create(data));
    } catch (error) {
      this.rethrowCodeConflict(error, data.code);
    }
  }

  async save(amenity: AmenityEntity): Promise<AmenityEntity> {
    try {
      return await this.repository.save(amenity);
    } catch (error) {
      this.rethrowCodeConflict(error, amenity.code);
    }
  }

  async delete(amenity: AmenityEntity): Promise<void> {
    await this.repository.remove(amenity);
  }

  private rethrowCodeConflict(error: unknown, code: string): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      throw new AmenityCodeConflictException(code);
    }
    throw error;
  }
}
