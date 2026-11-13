import {
  PlaceListResponse,
  PlacePriceResponse,
  PlaceResponse,
  PlaceSummaryResponse,
} from '../dtos/responses/place.response';
import type {
  PlaceDetailsData,
  PlacePriceData,
  PlaceSummaryData,
} from '../interfaces/place.repository.interface';

export class PlaceMapper {
  static toSummary(item: PlaceSummaryData): PlaceSummaryResponse {
    const { place } = item;
    return {
      id: place.id,
      name: place.name,
      city: place.city,
      category: item.category,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      status: place.status,
      averageRating: place.averageRating,
      reviewCount: place.reviewCount,
      estimatedVisitDurationMinutes: place.estimatedVisitDurationMinutes,
      primaryImageUrl: item.primaryImageUrl,
      price: this.toPrice(item.price),
    };
  }

  static toResponse(item: PlaceDetailsData): PlaceResponse {
    const { place } = item;
    return Object.assign(new PlaceResponse(), this.toSummary(item), {
      description: place.description,
      countryCode: place.countryCode,
      provinceCode: place.provinceCode,
      timezone: place.timezone,
      categories: item.categories,
      tags: item.tags,
      amenities: place.amenities,
      images: item.images.map((image, index) => ({
        imageUrl: image.imageUrl,
        isPrimary: index === 0,
        altText: image.altText,
        attributionText: image.attributionText,
      })),
      openingHours: place.openingHours,
      bestVisitTimes: place.bestVisitTimes,
      suitableFor: place.suitableFor,
      contact: {
        phone: place.contactPhone,
        website: place.contactWebsite,
      },
      source: {
        type: place.sourceType,
        provider: place.sourceProvider,
        sourceUrl: place.sourceUrl,
        attributionText: place.attributionText,
        licenseCode: place.licenseCode,
        lastRefreshedAt: place.lastRefreshedAt?.toISOString() ?? null,
      },
      catalogVersion: place.catalogVersion,
    });
  }

  static toListResponse(
    places: PlaceSummaryData[],
    page: number,
    limit: number,
    total: number,
  ): PlaceListResponse {
    return {
      data: places.map((place) => this.toSummary(place)),
      meta: { page, limit, total },
    };
  }

  private static toPrice(
    price: PlacePriceData | null,
  ): PlacePriceResponse | null {
    if (!price) return null;
    return {
      isFree: price.minPrice === 0 && price.maxPrice === 0,
      minPrice: price.minPrice,
      maxPrice: price.maxPrice,
      currency: price.currency,
    };
  }
}
