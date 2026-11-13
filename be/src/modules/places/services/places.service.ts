import { Inject, Injectable } from '@nestjs/common';
import { CreatePlaceRequest } from '../dtos/requests/create-place.request';
import { ListPlacesRequest } from '../dtos/requests/list-places.request';
import { UpdatePlaceRequest } from '../dtos/requests/update-place.request';
import { PlaceEntity, PlaceSourceType } from '../entities/place.entity';
import {
  CoordinatePairRequiredException,
  EmptyPlaceUpdateException,
  ExternalProviderConflictException,
  PlaceNotFoundException,
} from '../exceptions/place.exceptions';
import { PLACE_REPOSITORY } from '../interfaces/place.repository.interface';
import type {
  PlaceDetailsData,
  PlacePage,
  PlaceRepository,
} from '../interfaces/place.repository.interface';

@Injectable()
export class PlacesService {
  constructor(
    @Inject(PLACE_REPOSITORY)
    private readonly repository: PlaceRepository,
  ) {}

  async create(input: CreatePlaceRequest): Promise<PlaceEntity> {
    const externalProviderId = this.normalizeNullable(input.externalProviderId);
    await this.assertProviderAvailable(externalProviderId);

    const latitude = input.latitude;
    const longitude = input.longitude;
    this.assertCoordinatePair(latitude, longitude);

    return this.repository.create({
      name: input.name.trim(),
      description: this.normalizeNullable(input.description),
      address: this.normalizeNullable(input.address),
      city: null,
      countryCode: this.normalizeCode(input.countryCode),
      provinceCode: this.normalizeCode(input.provinceCode),
      timezone: this.normalizeNullable(input.timezone),
      latitude,
      longitude,
      status: input.status,
      averageRating: 0,
      reviewCount: 0,
      openingHours: input.openingTime
        ? { display: input.openingTime.trim() }
        : null,
      estimatedVisitDurationMinutes: null,
      amenities: [],
      bestVisitTimes: [],
      suitableFor: [],
      contactPhone: null,
      contactWebsite: null,
      // shortcut: legacy requests do not identify the provider, require it when the UC06 provider contract is expanded.
      sourceType: externalProviderId
        ? PlaceSourceType.PROVIDER
        : PlaceSourceType.MANUAL,
      sourceProvider: externalProviderId ? 'LEGACY' : null,
      externalProviderId,
      sourceUrl: null,
      attributionText: null,
      licenseCode: null,
      lastRefreshedAt: null,
    });
  }

  findPage(input: ListPlacesRequest): Promise<PlacePage> {
    return this.repository.findPage({
      page: input.page,
      limit: input.limit,
      search: input.search,
      status: input.status,
      countryCode: input.countryCode,
      provinceCode: input.provinceCode,
      minRating: input.minRating,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
  }

  async findById(id: string): Promise<PlaceEntity> {
    const place = await this.repository.findById(id);
    if (!place) throw new PlaceNotFoundException(id);
    return place;
  }

  async findDetailsById(id: string): Promise<PlaceDetailsData> {
    const place = await this.repository.findDetailsById(id);
    if (!place) throw new PlaceNotFoundException(id);
    return place;
  }

  async update(id: string, input: UpdatePlaceRequest): Promise<PlaceEntity> {
    if (this.isEmptyUpdate(input)) throw new EmptyPlaceUpdateException();
    const place = await this.findById(id);

    const nextLatitude =
      input.latitude === undefined ? place.latitude : input.latitude;
    const nextLongitude =
      input.longitude === undefined ? place.longitude : input.longitude;
    this.assertCoordinatePair(nextLatitude, nextLongitude);

    if (input.externalProviderId !== undefined) {
      const externalProviderId = this.normalizeNullable(
        input.externalProviderId,
      );
      if (externalProviderId !== place.externalProviderId) {
        await this.assertProviderAvailable(externalProviderId, place.id);
      }
      place.externalProviderId = externalProviderId;
    }

    if (input.name !== undefined) place.name = input.name.trim();
    if (input.description !== undefined) {
      place.description = this.normalizeNullable(input.description);
    }
    if (input.address !== undefined) {
      place.address = this.normalizeNullable(input.address);
    }
    if (input.countryCode !== undefined) {
      place.countryCode = this.normalizeCode(input.countryCode);
    }
    if (input.provinceCode !== undefined) {
      place.provinceCode = this.normalizeCode(input.provinceCode);
    }
    if (input.timezone !== undefined) {
      place.timezone = this.normalizeNullable(input.timezone);
    }
    if (input.latitude !== undefined) place.latitude = input.latitude;
    if (input.longitude !== undefined) place.longitude = input.longitude;
    if (input.status !== undefined) place.status = input.status;
    if (input.openingTime !== undefined) {
      const display = this.normalizeNullable(input.openingTime);
      place.openingHours = display ? { display } : null;
    }

    return this.repository.save(place);
  }

  async delete(id: string): Promise<void> {
    const place = await this.findById(id);
    await this.repository.delete(place);
  }

  private async assertProviderAvailable(
    externalProviderId: string | null,
    currentPlaceId?: string,
  ): Promise<void> {
    if (!externalProviderId) return;
    const duplicate =
      await this.repository.findByExternalProviderId(externalProviderId);
    if (duplicate && duplicate.id !== currentPlaceId) {
      throw new ExternalProviderConflictException();
    }
  }

  private assertCoordinatePair(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ): void {
    if (latitude == null || longitude == null) {
      throw new CoordinatePairRequiredException();
    }
  }

  private isEmptyUpdate(input: UpdatePlaceRequest): boolean {
    return [
      input.name,
      input.description,
      input.address,
      input.countryCode,
      input.provinceCode,
      input.timezone,
      input.latitude,
      input.longitude,
      input.status,
      input.externalProviderId,
      input.openingTime,
    ].every((value) => value === undefined);
  }

  private normalizeNullable(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }

  private normalizeCode(value?: string | null): string | null {
    const normalized = this.normalizeNullable(value);
    return normalized?.toUpperCase() ?? null;
  }
}
