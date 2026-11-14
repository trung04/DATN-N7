import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from '../../users/services/users.service';
import { CreateItineraryRequest } from '../dtos/requests/create-itinerary.request';
import { ListItinerariesRequest } from '../dtos/requests/list-itineraries.request';
import { UpdateItineraryRequest } from '../dtos/requests/update-itinerary.request';
import { ItineraryEntity } from '../entities/itinerary.entity';
import {
  EmptyItineraryUpdateException,
  InvalidItineraryDateRangeException,
  ItineraryNotFoundException,
} from '../exceptions/itinerary.exceptions';
import { ITINERARY_REPOSITORY } from '../interfaces/itinerary.repository.interface';
import type {
  ItineraryPage,
  ItineraryRepository,
} from '../interfaces/itinerary.repository.interface';

@Injectable()
export class ItinerariesService {
  constructor(
    @Inject(ITINERARY_REPOSITORY)
    private readonly repository: ItineraryRepository,
    private readonly usersService: UsersService,
  ) {}

  async create(
    input: CreateItineraryRequest & { touristUserId: string },
  ): Promise<ItineraryEntity> {
    await this.usersService.findById(input.touristUserId);
    this.assertDateRange(input.startDate, input.endDate);
    return this.repository.create({
      touristUserId: input.touristUserId,
      name: input.name.trim(),
      destinationCity: input.destinationCity.trim(),
      description: this.normalizeNullable(input.description),
      startDate: input.startDate,
      endDate: input.endDate,
      timezone: input.timezone,
      adultCount: input.adultCount,
      childCount: input.childCount,
      budget: input.budget ?? null,
      currency: input.currency.trim().toUpperCase(),
      status: input.status,
      isAiGenerated: false,
    });
  }

  findPage(input: ListItinerariesRequest): Promise<ItineraryPage> {
    return this.repository.findPage(input);
  }

  async findById(id: string): Promise<ItineraryEntity> {
    const itinerary = await this.repository.findById(id);
    if (!itinerary) throw new ItineraryNotFoundException(id);
    return itinerary;
  }

  async findByIdForTourist(
    id: string,
    touristUserId: string,
  ): Promise<ItineraryEntity> {
    const itinerary = await this.findById(id);
    if (itinerary.touristUserId !== touristUserId) {
      throw new ItineraryNotFoundException(id);
    }
    return itinerary;
  }

  async update(
    id: string,
    input: UpdateItineraryRequest,
    touristUserId?: string,
  ): Promise<ItineraryEntity> {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new EmptyItineraryUpdateException();
    }
    const itinerary = touristUserId
      ? await this.findByIdForTourist(id, touristUserId)
      : await this.findById(id);
    const startDate = input.startDate ?? itinerary.startDate;
    const endDate = input.endDate ?? itinerary.endDate;
    this.assertDateRange(startDate, endDate);

    if (input.name !== undefined) itinerary.name = input.name.trim();
    if (input.destinationCity !== undefined) {
      itinerary.destinationCity = input.destinationCity.trim();
    }
    if (input.description !== undefined) {
      itinerary.description = this.normalizeNullable(input.description);
    }
    itinerary.startDate = startDate;
    itinerary.endDate = endDate;
    if (input.timezone !== undefined) itinerary.timezone = input.timezone;
    if (input.adultCount !== undefined) itinerary.adultCount = input.adultCount;
    if (input.childCount !== undefined) itinerary.childCount = input.childCount;
    if (input.budget !== undefined) itinerary.budget = input.budget;
    if (input.currency !== undefined) {
      itinerary.currency = input.currency.trim().toUpperCase();
    }
    if (input.status !== undefined) itinerary.status = input.status;
    return this.repository.save(itinerary);
  }

  async delete(id: string, touristUserId?: string): Promise<void> {
    const itinerary = touristUserId
      ? await this.findByIdForTourist(id, touristUserId)
      : await this.findById(id);
    await this.repository.delete(itinerary);
  }

  private assertDateRange(startDate: string, endDate: string): void {
    if (endDate < startDate) throw new InvalidItineraryDateRangeException();
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }
}
