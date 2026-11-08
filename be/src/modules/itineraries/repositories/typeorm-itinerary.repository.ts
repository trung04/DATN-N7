import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItineraryEntity } from '../entities/itinerary.entity';
import type {
  CreateItineraryData,
  FindItinerariesOptions,
  ItineraryPage,
  ItineraryRepository,
} from '../interfaces/itinerary.repository.interface';

@Injectable()
export class TypeOrmItineraryRepository implements ItineraryRepository {
  constructor(
    @InjectRepository(ItineraryEntity)
    private readonly repository: Repository<ItineraryEntity>,
  ) {}

  findById(id: string): Promise<ItineraryEntity | null> {
    return this.repository.findOneBy({ id });
  }

  async findPage(options: FindItinerariesOptions): Promise<ItineraryPage> {
    const query = this.repository.createQueryBuilder('itinerary');
    if (options.search) {
      const escapedSearch = options.search.replace(/[\\%_]/g, '\\$&');
      query.andWhere(
        "(itinerary.name ILIKE :search ESCAPE '\\' OR itinerary.description ILIKE :search ESCAPE '\\')",
        { search: `%${escapedSearch}%` },
      );
    }
    if (options.touristUserId) {
      query.andWhere('itinerary.touristUserId = :touristUserId', {
        touristUserId: options.touristUserId,
      });
    }
    if (options.status) {
      query.andWhere('itinerary.status = :status', { status: options.status });
    }

    const sortColumns: Record<FindItinerariesOptions['sortBy'], string> = {
      name: 'itinerary.name',
      startDate: 'itinerary.startDate',
      endDate: 'itinerary.endDate',
      createdAt: 'itinerary.createdAt',
      updatedAt: 'itinerary.updatedAt',
    };
    const [items, total] = await query
      .orderBy(sortColumns[options.sortBy], options.sortOrder)
      .addOrderBy('itinerary.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
    return { items, total };
  }

  create(data: CreateItineraryData): Promise<ItineraryEntity> {
    return this.repository.save(this.repository.create(data));
  }

  save(itinerary: ItineraryEntity): Promise<ItineraryEntity> {
    return this.repository.save(itinerary);
  }

  async delete(itinerary: ItineraryEntity): Promise<void> {
    await this.repository.softRemove(itinerary);
  }
}
