import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { ItineraryEntity } from '../../itineraries/entities/itinerary.entity';
import { ItinerariesService } from '../../itineraries/services/itineraries.service';
import { CreateStopoverRequest } from '../dtos/requests/create-stopover.request';
import { ListStopoversRequest } from '../dtos/requests/list-stopovers.request';
import { UpdateStopoverRequest } from '../dtos/requests/update-stopover.request';
import { StopoverEntity } from '../entities/stopover.entity';
import {
  EmptyStopoverUpdateException,
  InvalidStopoverTimeRangeException,
  StopoverActivityRangeConflictException,
  StopoverDailyLimitException,
  StopoverNotFoundException,
  StopoverOrderConflictException,
  StopoverOutsideItineraryException,
  StopoverScheduleConflictException,
} from '../exceptions/stopover.exceptions';
import { STOPOVER_REPOSITORY } from '../interfaces/stopover.repository.interface';
import type {
  StopoverPage,
  StopoverRepository,
} from '../interfaces/stopover.repository.interface';

const MAX_STOPOVERS_PER_DAY = 10;

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
    touristUserId: string,
  ): Promise<StopoverEntity> {
    const itinerary = await this.itinerariesService.findByIdForTourist(
      itineraryId,
      touristUserId,
    );
    const arrivalTime = new Date(input.arrivalTime);
    const departureTime = new Date(input.departureTime);
    this.assertTimeRange(arrivalTime, departureTime);
    this.assertWithinItinerary(itinerary, arrivalTime, departureTime);
    const existing = await this.repository.findByItineraryId(itineraryId);
    this.assertScheduleAvailable(
      existing,
      arrivalTime,
      departureTime,
      itinerary.timezone,
    );
    if (existing.some((stopover) => stopover.stopOrder === input.stopOrder)) {
      throw new StopoverOrderConflictException(itineraryId, input.stopOrder);
    }
    return this.repository.create({
      itineraryId,
      placeId: input.placeId ?? null,
      customName: input.placeId ? null : input.customName!.trim(),
      customAddress: input.placeId
        ? null
        : this.normalizeNullable(input.customAddress),
      latitude: input.placeId ? null : input.latitude!,
      longitude: input.placeId ? null : input.longitude!,
      stopOrder: input.stopOrder,
      arrivalTime,
      departureTime,
      description: this.normalizeNullable(input.description),
    });
  }

  async findPage(
    itineraryId: string,
    input: ListStopoversRequest,
    touristUserId: string,
  ): Promise<StopoverPage> {
    await this.itinerariesService.findByIdForTourist(
      itineraryId,
      touristUserId,
    );
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

  async findByIdForTourist(
    id: string,
    touristUserId: string,
  ): Promise<StopoverEntity> {
    const stopover = await this.findById(id);
    await this.itinerariesService.findByIdForTourist(
      stopover.itineraryId,
      touristUserId,
    );
    return stopover;
  }

  async findByItineraryAndId(
    itineraryId: string,
    id: string,
    touristUserId: string,
  ): Promise<StopoverEntity> {
    await this.itinerariesService.findByIdForTourist(
      itineraryId,
      touristUserId,
    );
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
    touristUserId: string,
  ): Promise<StopoverEntity> {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new EmptyStopoverUpdateException();
    }
    const itinerary = await this.itinerariesService.findByIdForTourist(
      itineraryId,
      touristUserId,
    );
    const stopover = await this.repository.findByIdAndItineraryId(
      id,
      itineraryId,
    );
    if (!stopover) throw new StopoverNotFoundException(id);
    const stopOrder = input.stopOrder ?? stopover.stopOrder;
    const arrivalTime = input.arrivalTime
      ? new Date(input.arrivalTime)
      : stopover.arrivalTime;
    const departureTime = input.departureTime
      ? new Date(input.departureTime)
      : stopover.departureTime;
    this.assertTimeRange(arrivalTime, departureTime);
    this.assertWithinItinerary(itinerary, arrivalTime, departureTime);
    const existing = (
      await this.repository.findByItineraryId(itineraryId)
    ).filter((item) => item.id !== id);
    this.assertScheduleAvailable(
      existing,
      arrivalTime,
      departureTime,
      itinerary.timezone,
    );
    if (
      (input.arrivalTime !== undefined || input.departureTime !== undefined) &&
      (await this.repository.hasActivitiesOutsideRange(
        id,
        arrivalTime,
        departureTime,
      ))
    ) {
      throw new StopoverActivityRangeConflictException();
    }

    if (stopOrder !== stopover.stopOrder) {
      const duplicate = existing.find((item) => item.stopOrder === stopOrder);
      if (duplicate && duplicate.id !== id) {
        throw new StopoverOrderConflictException(itineraryId, stopOrder);
      }
    }
    stopover.stopOrder = stopOrder;
    stopover.arrivalTime = arrivalTime;
    stopover.departureTime = departureTime;
    if (input.placeId !== undefined) {
      stopover.placeId = input.placeId;
      if (input.placeId) {
        stopover.customName = null;
        stopover.customAddress = null;
        stopover.latitude = null;
        stopover.longitude = null;
      }
    }
    if (input.customName !== undefined) {
      stopover.placeId = null;
      stopover.customName = input.customName?.trim() || null;
    }
    if (input.customAddress !== undefined) {
      stopover.customAddress = this.normalizeNullable(input.customAddress);
    }
    if (input.latitude !== undefined) stopover.latitude = input.latitude;
    if (input.longitude !== undefined) stopover.longitude = input.longitude;
    if (
      !stopover.placeId &&
      (!stopover.customName ||
        stopover.latitude === null ||
        stopover.longitude === null)
    ) {
      throw new BadRequestException(
        'Điểm dừng tùy chỉnh cần tên và tọa độ hợp lệ.',
      );
    }
    if (input.description !== undefined) {
      stopover.description = this.normalizeNullable(input.description);
    }
    return this.repository.save(stopover);
  }

  async delete(
    itineraryId: string,
    id: string,
    touristUserId: string,
  ): Promise<void> {
    await this.repository.delete(
      await this.findByItineraryAndId(itineraryId, id, touristUserId),
    );
  }

  private assertTimeRange(arrivalTime: Date, departureTime: Date): void {
    if (departureTime <= arrivalTime) {
      throw new InvalidStopoverTimeRangeException();
    }
  }

  private assertWithinItinerary(
    itinerary: ItineraryEntity,
    arrivalTime: Date,
    departureTime: Date,
  ): void {
    const arrivalDate = this.dateInTimeZone(arrivalTime, itinerary.timezone);
    const departureDate = this.dateInTimeZone(
      departureTime,
      itinerary.timezone,
    );
    if (
      arrivalDate < itinerary.startDate ||
      departureDate > itinerary.endDate
    ) {
      throw new StopoverOutsideItineraryException();
    }
  }

  private assertScheduleAvailable(
    existing: StopoverEntity[],
    arrivalTime: Date,
    departureTime: Date,
    timezone: string,
  ): void {
    const overlap = existing.find(
      (stopover) =>
        arrivalTime < stopover.departureTime &&
        stopover.arrivalTime < departureTime,
    );
    if (overlap) throw new StopoverScheduleConflictException(overlap.id);

    for (const date of this.occupiedDates(
      arrivalTime,
      departureTime,
      timezone,
    )) {
      const count = existing.filter((stopover) =>
        this.occupiesDate(stopover, date, timezone),
      ).length;
      if (count >= MAX_STOPOVERS_PER_DAY) {
        throw new StopoverDailyLimitException(date, MAX_STOPOVERS_PER_DAY);
      }
    }
  }

  private occupiesDate(
    stopover: StopoverEntity,
    date: string,
    timezone: string,
  ): boolean {
    const [first, last] = this.occupiedDateRange(
      stopover.arrivalTime,
      stopover.departureTime,
      timezone,
    );
    return first <= date && date <= last;
  }

  private occupiedDates(start: Date, end: Date, timezone: string): string[] {
    const [first, last] = this.occupiedDateRange(start, end, timezone);
    const current = new Date(`${first}T00:00:00.000Z`);
    const dates: string[] = [];
    while (current.toISOString().slice(0, 10) <= last) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
  }

  private occupiedDateRange(
    start: Date,
    end: Date,
    timezone: string,
  ): [string, string] {
    return [
      this.dateInTimeZone(start, timezone),
      this.dateInTimeZone(new Date(end.getTime() - 1), timezone),
    ];
  }

  private dateInTimeZone(value: Date, timezone: string): string {
    const parts = new Map(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .formatToParts(value)
        .map((part) => [part.type, part.value]),
    );
    return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }
}
