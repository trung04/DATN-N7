import { Inject, Injectable } from '@nestjs/common';
import { SaveTravelPreferenceRequest } from '../dtos/requests/save-travel-preference.request';
import { TravelPreferenceResponse } from '../dtos/responses/travel-preference.response';
import { InvalidTravelPreferenceInterestException } from '../exceptions/travel-preference.exceptions';
import {
  TRAVEL_PREFERENCE_REPOSITORY,
} from '../interfaces/travel-preference.repository.interface';
import type { TravelPreferenceRepository } from '../interfaces/travel-preference.repository.interface';

const supportedInterestCodes = new Set([
  'BEACH',
  'NATURE',
  'FOOD',
  'CULTURE',
  'SHOPPING',
  'RELAXATION',
  'EXPLORATION',
  'FAMILY',
]);

@Injectable()
export class TravelPreferencesService {
  constructor(
    @Inject(TRAVEL_PREFERENCE_REPOSITORY)
    private readonly repository: TravelPreferenceRepository,
  ) {}

  async findForUser(userId: string): Promise<TravelPreferenceResponse | null> {
    const preference = await this.repository.findByUserId(userId);
    return preference ? this.toResponse(preference) : null;
  }

  async saveForUser(
    userId: string,
    input: SaveTravelPreferenceRequest,
  ): Promise<TravelPreferenceResponse> {
    const interestCodes = [...new Set(input.interestCodes.map((code) => code.trim().toUpperCase()))];
    if (interestCodes.some((code) => !supportedInterestCodes.has(code))) {
      throw new InvalidTravelPreferenceInterestException();
    }

    const preference = await this.repository.save({
      userId,
      interestCodes,
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
    interests: string[];
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
}
