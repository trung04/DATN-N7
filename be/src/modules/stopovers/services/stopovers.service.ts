import { Inject, Injectable } from '@nestjs/common';
import { ItinerariesService } from '../../itineraries/services/itineraries.service';
import { CreateStopoverRequest } from '../dtos/requests/create-stopover.request';
import { ListStopoversRequest } from '../dtos/requests/list-stopovers.request';
import { UpdateStopoverRequest } from '../dtos/requests/update-stopover.request';
import { StopoverEntity } from '../entities/stopover.entity';
import {
  EmptyStopoverUpdateException,
  InvalidStopoverTimeRangeException,
  StopoverNotFoundException,
  StopoverOrderConflictException,
} from '../exceptions/stopover.exceptions';
import { STOPOVER_REPOSITORY } from '../interfaces/stopover.repository.interface';
import type {
  StopoverPage,
  StopoverRepository,
} from '../interfaces/stopover.repository.interface';

@Injectable()
export class StopoversService {
  constructor(
    @Inject(STOPOVER_REPOSITORY)
    private readonly repository: StopoverRepository,
    private readonly itinerariesService: ItinerariesService,
  ) {}

  async create(
    itineraryId: string,
    input: CreateStopoverRequest,
  ): Promise<StopoverEntity> {
    await this.itinerariesService.findById(itineraryId);
    this.assertTimeRange(input.arrivalTime, input.departureTime);
    if (
      await this.repository.findByItineraryAndOrder(
        itineraryId,
        input.stopOrder,
      )
    ) {
      throw new StopoverOrderConflictException(itineraryId, input.stopOrder);
    }
    return this.repository.create({
      itineraryId,
      placeId: input.placeId,
      stopOrder: input.stopOrder,
      arrivalTime: new Date(input.arrivalTime),
      departureTime: new Date(input.departureTime),
      description: this.normalizeNullable(input.description),
    });
  }

  async findPage(
    itineraryId: string,
    input: ListStopoversRequest,
  ): Promise<StopoverPage> {
    await this.itinerariesService.findById(itineraryId);
    return this.repository.findPage({
      itineraryId,
      page: input.page,
      limit: input.limit,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
  }

  async findById(id: string): Promise<StopoverEntity> {
    const stopover = await this.repository.findById(id);
    if (!stopover) throw new StopoverNotFoundException(id);
    await this.itinerariesService.findById(stopover.itineraryId);
    return stopover;
  }

  async findByItineraryAndId(
    itineraryId: string,
    id: string,
  ): Promise<StopoverEntity> {
    await this.itinerariesService.findById(itineraryId);
    const stopover = await this.repository.findByIdAndItineraryId(
      id,
      itineraryId,
    );
    if (!stopover) throw new StopoverNotFoundException(id);
    return stopover;
  }

  async update(
    itineraryId: string,
    id: string,
    input: UpdateStopoverRequest,
  ): Promise<StopoverEntity> {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new EmptyStopoverUpdateException();
    }
    const stopover = await this.findByItineraryAndId(itineraryId, id);
    const stopOrder = input.stopOrder ?? stopover.stopOrder;
    const arrivalTime = input.arrivalTime ?? stopover.arrivalTime.toISOString();
    const departureTime =
      input.departureTime ?? stopover.departureTime.toISOString();
    this.assertTimeRange(arrivalTime, departureTime);

    if (stopOrder !== stopover.stopOrder) {
      const duplicate = await this.repository.findByItineraryAndOrder(
        itineraryId,
        stopOrder,
      );
      if (duplicate && duplicate.id !== id) {
        throw new StopoverOrderConflictException(itineraryId, stopOrder);
      }
    }
    stopover.stopOrder = stopOrder;
    stopover.arrivalTime = new Date(arrivalTime);
    stopover.departureTime = new Date(departureTime);
    if (input.placeId !== undefined) stopover.placeId = input.placeId;
    if (input.description !== undefined) {
      stopover.description = this.normalizeNullable(input.description);
    }
    return this.repository.save(stopover);
  }

  async delete(itineraryId: string, id: string): Promise<void> {
    await this.repository.delete(
      await this.findByItineraryAndId(itineraryId, id),
    );
  }

  private assertTimeRange(arrivalTime: string, departureTime: string): void {
    if (new Date(departureTime) <= new Date(arrivalTime)) {
      throw new InvalidStopoverTimeRangeException();
    }
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }
}
