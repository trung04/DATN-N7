import type { PlaceDetailsData } from '../../places/interfaces/place.repository.interface';
import type { PlanTravelRequest } from '../dtos/requests/travel-ai.request';
import type { TravelPlanResponse } from '../dtos/responses/travel-ai.response';
import type { PlanPreview } from '../interfaces/travel-ai.integration';

export function toTravelPlan(
  userId: string,
  input: PlanTravelRequest,
  preview: PlanPreview,
  activities: Array<{
    activity: PlanPreview['days'][number]['activities'][number];
    place: PlaceDetailsData['place'];
  }>,
): TravelPlanResponse {
  const stops: TravelPlanResponse['stops'] = [];
  const plannedActivities: TravelPlanResponse['activities'] = [];
  for (const [index, { activity, place }] of activities.entries()) {
    const id = `${preview.id}-${index + 1}`;
    const note = activity.notes.join(' ').slice(0, 5000);
    stops.push({
      id,
      tripId: preview.id,
      placeId: place.id,
      name: place.name,
      address: place.address ?? '',
      lat: place.latitude ?? undefined,
      lng: place.longitude ?? undefined,
      start: activity.start,
      end: activity.end,
      order: index + 1,
      note,
    });
    plannedActivities.push({
      id: `${id}-activity`,
      stopId: id,
      placeId: place.id,
      name: place.name.slice(0, 200),
      start: activity.start,
      end: activity.end,
      order: 1,
      note,
      cost: null,
    });
  }

  return {
    trip: {
      id: preview.id,
      userId,
      name: `Khám phá ${input.city}`,
      city: input.city,
      startDate: input.startDate,
      endDate: input.endDate,
      adults: input.adults,
      children: input.children,
      budget: input.budget,
      note: input.note,
      status: 'DRAFT',
      source: 'demo-planner',
    },
    stops,
    activities: plannedActivities,
    totalCost: null,
    explanation: preview.summary,
    warnings: preview.warnings,
    input,
  };
}
