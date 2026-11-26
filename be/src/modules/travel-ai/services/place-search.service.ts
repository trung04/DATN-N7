import { Inject, Injectable, Logger } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PlaceStatus } from '../../places/entities/place.entity';
import { PlaceMapper } from '../../places/mappers/place.mapper';
import { PlacesService } from '../../places/services/places.service';
import { SearchPlacesRequest } from '../dtos/requests/search-places.request';
import { TravelAiException } from '../exceptions/travel-ai.exceptions';
import { TRAVEL_AI } from '../interfaces/travel-ai.integration';
import type { TravelAiIntegration } from '../interfaces/travel-ai.integration';

@Injectable()
export class PlaceSearchService {
  private readonly logger = new Logger(PlaceSearchService.name);

  constructor(
    @Inject(TRAVEL_AI) private readonly integration: TravelAiIntegration,
    private readonly places: PlacesService,
  ) {}

  async search(input: SearchPlacesRequest) {
    const { page, limit } = input;
    const catalogQuery = Object.assign(new SearchPlacesRequest(), input, {
      status: PlaceStatus.ACTIVE,
    });
    const semantic = await this.searchIndex(catalogQuery);
    if (semantic) return semantic;

    const fallback = await this.places.findPage(catalogQuery);
    return Object.assign(
      PlaceMapper.toListResponse(fallback.items, page, limit, fallback.total),
      { searchMode: 'keyword' as const },
    );
  }

  private async searchIndex(
    input: SearchPlacesRequest & { status: PlaceStatus },
  ) {
    const { page, limit, search, city, categoryCode, sortBy, sortOrder } =
      input;
    const offset = (page - 1) * limit;
    if (!search || !/[\p{L}\p{N}]/u.test(search) || offset > 10000) return;

    const category = categoryCode
      ? (await this.places.findCatalogOptions()).categories.find(
          (entry) => entry.code === categoryCode,
        )?.name
      : undefined;
    if (categoryCode && !category) return;

    let result;
    try {
      result = await this.integration.searchPlaces({
        query: search,
        city,
        category,
        sortBy: input.relevance
          ? 'relevance'
          : sortBy === 'averageRating'
            ? 'rating'
            : 'name',
        sortOrder,
        offset,
        limit,
      });
    } catch (error) {
      if (!(error instanceof TravelAiException)) throw error;
      this.logger.warn({ code: error.code });
      return;
    }
    if (!result.total) return;

    const matches = result.ids.every((id) => isUUID(id, '4'))
      ? await this.places.findPage(
          Object.assign(new SearchPlacesRequest(), input, {
            page: 1,
            search: undefined,
          }),
          result.ids,
        )
      : undefined;
    if (!matches || matches.items.length !== result.ids.length) {
      this.logger.warn('Place search index differs from the public catalog');
      return;
    }
    const searchMode =
      result.usedSemanticRanking || result.ids.length === 0
        ? 'semantic'
        : 'keyword';
    return Object.assign(
      PlaceMapper.toListResponse(matches.items, page, limit, result.total),
      { searchMode },
    );
  }
}
