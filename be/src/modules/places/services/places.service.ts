import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ImageStorage } from '../../media/image-storage.interface';
import { normalizeLodgingImage, type UploadedLodgingImage } from '../../media/normalize-lodging-image';
import { CreatePlaceRequest } from '../dtos/requests/create-place.request';
import { ListPlacesRequest } from '../dtos/requests/list-places.request';
import { UpdatePlaceRequest } from '../dtos/requests/update-place.request';
import { PlaceEntity, PlaceSourceType } from '../entities/place.entity';
import { InvalidPlaceImageException, PlaceImageNotFoundException } from '../exceptions/place-image.exceptions';
import { PLACE_IMAGE_STORAGE } from '../integrations/s3-place-image.storage';
import {
  CoordinatePairRequiredException,
  EmptyPlaceUpdateException,
  ExternalProviderConflictException,
  InvalidPlacePriceException,
  PlaceNotFoundException,
} from '../exceptions/place.exceptions';
import { PLACE_REPOSITORY } from '../interfaces/place.repository.interface';
import type {
  PlaceCatalogOptions,
  PlaceCatalogWriteData,
  PlaceDetailsData,
  PlacePage,
  PlaceRepository,
} from '../interfaces/place.repository.interface';

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    @Inject(PLACE_REPOSITORY)
    private readonly repository: PlaceRepository,
    @Inject(PLACE_IMAGE_STORAGE)
    private readonly storage: ImageStorage,
  ) {}

  async create(input: CreatePlaceRequest, file?: UploadedLodgingImage): Promise<PlaceEntity> {
    const externalProviderId = this.normalizeNullable(input.externalProviderId);
    await this.assertProviderAvailable(externalProviderId);

    const latitude = input.latitude;
    const longitude = input.longitude;
    this.assertCoordinatePair(latitude, longitude);

    this.assertReferencePrice(input.referencePrice);
    const data = {
      name: input.name.trim(),
      description: this.normalizeNullable(input.description),
      address: this.normalizeNullable(input.address),
      city: this.normalizeNullable(input.city),
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
    };
    return this.writeWithImage(input, file, (catalog) => this.repository.create(data, catalog));
  }

  findCatalogOptions(): Promise<PlaceCatalogOptions> {
    return this.repository.findCatalogOptions();
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

  async update(id: string, input: UpdatePlaceRequest, file?: UploadedLodgingImage): Promise<PlaceEntity> {
    if (!file && this.isEmptyUpdate(input)) throw new EmptyPlaceUpdateException();
    const place = await this.findById(id);
    this.assertReferencePrice(input.referencePrice);

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
    if (input.city !== undefined) {
      place.city = this.normalizeNullable(input.city);
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

    return this.writeWithImage(input, file, (catalog) => this.repository.save(place, catalog));
  }

  async delete(id: string): Promise<void> {
    const place = await this.findById(id);
    await this.repository.delete(place);
  }

  async readImage(placeId: string, imageId: string): Promise<Buffer> {
    const key = await this.repository.findImageObjectKey(placeId, imageId);
    if (!key) throw new PlaceImageNotFoundException();
    return this.storage.get(key);
  }

  private async writeWithImage(
    input: CreatePlaceRequest | UpdatePlaceRequest,
    file: UploadedLodgingImage | undefined,
    write: (catalog: PlaceCatalogWriteData) => Promise<PlaceEntity>,
  ): Promise<PlaceEntity> {
    const catalog = this.catalogInput(input);
    if (!file) return write(catalog);

    let image: Awaited<ReturnType<typeof normalizeLodgingImage>>;
    try {
      image = await normalizeLodgingImage(file);
    } catch {
      throw new InvalidPlaceImageException();
    }

    const objectKey = `places/${randomUUID()}.webp`;
    await this.storage.put(objectKey, image.data, 'image/webp');
    try {
      return await write({
        ...catalog,
        uploadedImage: { objectKey, byteSize: image.size, width: image.width, height: image.height },
      });
    } catch (error) {
      try {
        await this.storage.delete(objectKey);
      } catch {
        this.logger.error('Failed to remove an unlinked place image');
      }
      throw error;
    }
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
      input.city,
      input.countryCode,
      input.provinceCode,
      input.timezone,
      input.latitude,
      input.longitude,
      input.status,
      input.externalProviderId,
      input.openingTime,
      input.categoryCode,
      input.topicCodes,
      input.imageUrl,
      input.imageAltText,
      input.referencePrice,
    ].every((value) => value === undefined);
  }

  private catalogInput(input: CreatePlaceRequest | UpdatePlaceRequest): PlaceCatalogWriteData {
    return {
      ...(input.categoryCode !== undefined
        ? { categoryCodes: [input.categoryCode.trim().toUpperCase()] }
        : {}),
      ...(input.topicCodes !== undefined
        ? { topicCodes: input.topicCodes.map((code) => code.trim().toUpperCase()) }
        : {}),
      ...(input.imageUrl !== undefined
        ? { imageUrl: this.normalizeNullable(input.imageUrl) }
        : {}),
      ...(input.imageAltText !== undefined
        ? { imageAltText: this.normalizeNullable(input.imageAltText) }
        : {}),
      ...(input.referencePrice !== undefined
        ? {
            referencePrice: input.referencePrice
              ? {
                  ...input.referencePrice,
                  currency: input.referencePrice.currency.toUpperCase(),
                  pricingUnit: input.referencePrice.pricingUnit.trim(),
                  description: this.normalizeNullable(input.referencePrice.description),
                }
              : null,
          }
        : {}),
    };
  }

  private assertReferencePrice(
    referencePrice: CreatePlaceRequest['referencePrice'] | UpdatePlaceRequest['referencePrice'],
  ): void {
    if (referencePrice && referencePrice.maxPrice < referencePrice.minPrice) {
      throw new InvalidPlacePriceException();
    }
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
