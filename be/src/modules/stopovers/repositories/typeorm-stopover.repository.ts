import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { StopoverEntity } from '../entities/stopover.entity';
import { StopoverOrderConflictException } from '../exceptions/stopover.exceptions';
import type {
  CreateStopoverData,
  FindStopoversOptions,
  StopoverPage,
  StopoverRepository,
} from '../interfaces/stopover.repository.interface';

@Injectable()
export class TypeOrmStopoverRepository implements StopoverRepository {
  constructor(
    @InjectRepository(StopoverEntity)
    private readonly repository: Repository<StopoverEntity>,
  ) {}

  findById(id: string): Promise<StopoverEntity | null> {
    return this.repository.findOneBy({ id });
  }

  findByIdAndItineraryId(
    id: string,
    itineraryId: string,
  ): Promise<StopoverEntity | null> {
    return this.repository.findOneBy({ id, itineraryId });
  }

  findByItineraryAndOrder(
    itineraryId: string,
    stopOrder: number,
  ): Promise<StopoverEntity | null> {
    return this.repository.findOneBy({ itineraryId, stopOrder });
  }

  async findPage(options: FindStopoversOptions): Promise<StopoverPage> {
    const sortColumns: Record<FindStopoversOptions['sortBy'], string> = {
      stopOrder: 'stopover.stopOrder',
      arrivalTime: 'stopover.arrivalTime',
      departureTime: 'stopover.departureTime',
      createdAt: 'stopover.createdAt',
    };
    const [items, total] = await this.repository
      .createQueryBuilder('stopover')
      .where('stopover.itineraryId = :itineraryId', {
        itineraryId: options.itineraryId,
      })
      .orderBy(sortColumns[options.sortBy], options.sortOrder)
      .addOrderBy('stopover.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
    return { items, total };
  }

  async create(data: CreateStopoverData): Promise<StopoverEntity> {
    try {
      return await this.repository.save(this.repository.create(data));
    } catch (error) {
      this.rethrowOrderConflict(error, data.itineraryId, data.stopOrder);
    }
  }

  async save(stopover: StopoverEntity): Promise<StopoverEntity> {
    try {
      return await this.repository.save(stopover);
    } catch (error) {
      this.rethrowOrderConflict(
        error,
        stopover.itineraryId,
        stopover.stopOrder,
      );
    }
  }

  async delete(stopover: StopoverEntity): Promise<void> {
    await this.repository.softRemove(stopover);
  }

  private rethrowOrderConflict(
    error: unknown,
    itineraryId: string,
    stopOrder: number,
  ): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      throw new StopoverOrderConflictException(itineraryId, stopOrder);
    }
    throw error;
  }
}
