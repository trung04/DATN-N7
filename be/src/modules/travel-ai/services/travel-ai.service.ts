import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { HotelsService } from '../../hotels/services/hotels.service';
import { PlaceStatus } from '../../places/entities/place.entity';
import { PlaceNotFoundException } from '../../places/exceptions/place.exceptions';
import { PlacesService } from '../../places/services/places.service';
import { TravelPreferencesService } from '../../users/services/travel-preferences.service';
import type {
  PlanTravelRequest,
  RecommendTravelRequest,
} from '../dtos/requests/travel-ai.request';
import type {
  TravelPlanResponse,
  TravelRecommendationResponse,
} from '../dtos/responses/travel-ai.response';
import { TravelAiException } from '../exceptions/travel-ai.exceptions';
import { TRAVEL_AI } from '../interfaces/travel-ai.integration';
import type {
  PlanPreview,
  Recommendation,
  TravelAiIntegration,
} from '../interfaces/travel-ai.integration';
import { toTravelPlan } from '../mappers/travel-plan.mapper';

const dayMs = 24 * 60 * 60 * 1000;
const vietnamOffset = 7 * 60 * 60 * 1000;
const vietnamTime =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?\+07:00$/;

@Injectable()
export class TravelAiService {
  constructor(
    @Inject(TRAVEL_AI) private readonly ai: TravelAiIntegration,
    private readonly places: PlacesService,
    private readonly hotels: HotelsService,
    private readonly preferences: TravelPreferencesService,
  ) {}

  async recommend(
    userId: string,
    input: RecommendTravelRequest,
  ): Promise<TravelRecommendationResponse[]> {
    const saved = input.usePreferences
      ? await this.preferences.findForUser(userId)
      : null;
    const candidates = await this.ai.recommend({
      userId,
      query: input.query,
      preferences: saved?.interests ?? [],
      personalized: input.usePreferences,
    });

    const results = await Promise.all(
      candidates.map((candidate) => this.recommendation(candidate)),
    );
    const unique = new Map<string, TravelRecommendationResponse>();
    for (const result of results) {
      if (result && !unique.has(result.id)) unique.set(result.id, result);
    }
    if (candidates.some((item) => item.type !== 'Restaurant') && !unique.size) {
      throw new TravelAiException('catalog');
    }
    return [...unique.values()];
  }

  async plan(
    userId: string,
    input: PlanTravelRequest,
  ): Promise<TravelPlanResponse> {
    const start = Date.parse(input.startDate);
    const days = (Date.parse(input.endDate) - start) / dayMs + 1;
    const guests = input.adults + input.children;
    if (days < 1 || days > 10 || !Number.isInteger(days) || guests > 100) {
      throw new BadRequestException(
        'Chuyến đi cần từ 1 đến 10 ngày và tối đa 100 khách.',
      );
    }
    const today = new Date(Date.now() + vietnamOffset)
      .toISOString()
      .slice(0, 10);
    if (input.startDate < today)
      throw new BadRequestException('Ngày bắt đầu không được ở quá khứ.');

    const preview = await this.ai.preview({
      userId,
      city: input.city,
      startDate: input.startDate,
      days,
      guests,
      preferences: [
        ...new Set(input.interests.map((item) => item.trim()).filter(Boolean)),
      ],
      query: [input.style, input.note].filter(Boolean).join('. '),
      stopsPerDay: input.style === 'Nghỉ dưỡng' ? 2 : 3,
    });

    this.validateSchedule(preview, input.startDate, start, days, guests);
    const activities = preview.days.flatMap((day) => day.activities);
    if (!activities.length) throw new TravelAiException('noPlan');

    const ids = [...new Set(activities.map((item) => item.placeId))];
    const catalog = new Map(
      await Promise.all(
        ids.map(async (id) => [id, await this.activePlace(id)] as const),
      ),
    );
    return toTravelPlan(
      userId,
      input,
      preview,
      activities.map((activity) => {
        const record = catalog.get(activity.placeId);
        if (
          !record ||
          record.place.city?.trim().toLowerCase() !==
            input.city.trim().toLowerCase()
        ) {
          throw new TravelAiException('catalog');
        }
        return { activity, place: record.place };
      }),
    );
  }

  private validateSchedule(
    preview: PlanPreview,
    startDate: string,
    start: number,
    days: number,
    guests: number,
  ): void {
    if (
      preview.startDate !== startDate ||
      preview.days.length !== days ||
      preview.partySize !== guests
    ) {
      throw new TravelAiException('invalid');
    }

    for (const [index, day] of preview.days.entries()) {
      if (
        day.date !== new Date(start + index * dayMs).toISOString().slice(0, 10)
      ) {
        throw new TravelAiException('invalid');
      }
      let previousEnd = -Infinity;
      for (const activity of day.activities) {
        const activityStart = Date.parse(activity.start);
        const activityEnd = Date.parse(activity.end);
        if (
          !vietnamTime.test(activity.start) ||
          !vietnamTime.test(activity.end) ||
          !activity.start.startsWith(`${day.date}T`) ||
          !activity.end.startsWith(`${day.date}T`) ||
          !Number.isFinite(activityStart) ||
          !Number.isFinite(activityEnd) ||
          activityStart < previousEnd ||
          activityEnd <= activityStart
        )
          throw new TravelAiException('invalid');
        previousEnd = activityEnd;
      }
    }
  }

  private async recommendation(
    candidate: Recommendation,
  ): Promise<TravelRecommendationResponse | null> {
    if (candidate.type === 'Restaurant' || !isUUID(candidate.placeId, '4'))
      return null;
    const common = {
      score: candidate.score,
      reason: candidate.reasons.join(' · '),
    };
    if (candidate.type === 'Hotel') {
      const { items } = await this.hotels.findPublicPage({
        placeId: candidate.placeId,
        page: 1,
        limit: 1,
        sortBy: 'name',
        sortOrder: 'ASC',
      });
      const hotel = items[0];
      return hotel
        ? {
            ...common,
            id: hotel.id,
            type: 'hotel',
            name: hotel.name,
        city: candidate.city,
            price: null,
            tags: [],
            description: hotel.description ?? '',
          }
        : null;
    }
    const record = await this.activePlace(candidate.placeId);
    if (!record) return null;
    return {
      ...common,
      id: record.place.id,
      type: 'destination',
      name: record.place.name,
      city: record.place.city ?? candidate.city,
      price: record.price?.currency === 'VND' ? record.price.minPrice : null,
      tags: record.tags,
      description: record.place.description ?? '',
    };
  }

  private async activePlace(id: string) {
    if (!isUUID(id, '4')) return null;
    try {
      const result = await this.places.findDetailsById(id);
      return result.place.status === PlaceStatus.ACTIVE ? result : null;
    } catch (error) {
      if (error instanceof PlaceNotFoundException) return null;
      throw error;
    }
  }
}
