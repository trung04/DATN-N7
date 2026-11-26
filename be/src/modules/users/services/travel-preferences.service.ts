import { Inject, Injectable } from '@nestjs/common';
import { SaveTravelPreferenceRequest } from '../dtos/requests/save-travel-preference.request';
import { TravelPreferenceResponse } from '../dtos/responses/travel-preference.response';
import { InvalidTravelPreferenceInterestException } from '../exceptions/travel-preference.exceptions';
import {
  TRAVEL_PREFERENCE_REPOSITORY,
} from '../interfaces/travel-preference.repository.interface';
import type { TravelPreferenceRepository } from '../interfaces/travel-preference.repository.interface';
import { PlacesService } from '../../places/services/places.service';
import type { PreferenceOptionsResponse } from '../dtos/responses/travel-preference.response';

@Injectable()
export class TravelPreferencesService {
  constructor(
    @Inject(TRAVEL_PREFERENCE_REPOSITORY)
    private readonly repository: TravelPreferenceRepository,
    private readonly placesService: PlacesService,
  ) {}

  async findOptions(): Promise<PreferenceOptionsResponse> {
    const { categories, topics } = await this.placesService.findPreferenceOptions();
    return { categories, topics };
  }

  async findForUser(userId: string): Promise<TravelPreferenceResponse | null> {
    const preference = await this.repository.findByUserId(userId);
    return preference ? this.toResponse(preference) : null;
  }

  async saveForUser(
    userId: string,
    input: SaveTravelPreferenceRequest,
  ): Promise<TravelPreferenceResponse> {
    const categoryCodes = this.normalizeCodes(input.categoryCodes);
    const topicCodes = this.normalizeCodes(input.topicCodes);
    const options = await this.findOptions();
    const supportedCategories = new Set(options.categories.map((item) => item.code));
    const supportedTopics = new Set(options.topics.map((item) => item.code));
    if (
      categoryCodes.some((code) => !supportedCategories.has(code)) ||
      topicCodes.some((code) => !supportedTopics.has(code))
    ) {
      throw new InvalidTravelPreferenceInterestException();
    }

    const preference = await this.repository.save({
      userId,
      categoryCodes,
      topicCodes,
      budget: input.budget,
      style: input.style,
      transport: input.transport,
      destinations: [...new Set(input.destinations.map((destination) => destination.trim()).filter(Boolean))],
    });
    return this.toResponse(preference);
  }

  deleteForUser(userId: string): Promise<void> {
    return this.repository.deleteByUserId(userId);
  }

  private toResponse(data: {
    userId: string;
    categories: Array<{ code: string; name: string }>;
    topics: Array<{ code: string; name: string }>;
    budget: number;
    style: string;
    transport: string;
    destinations: string[];
    updatedAt: Date;
  }): TravelPreferenceResponse {
    return {
      ...data,
      updatedAt: data.updatedAt.toISOString(),
    };
  }

  private normalizeCodes(values: string[]): string[] {
    return [...new Set(values.map((code) => code.trim().toUpperCase()))];
  }
}
