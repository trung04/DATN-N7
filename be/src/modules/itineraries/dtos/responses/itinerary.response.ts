import { ItineraryStatus } from '../../entities/itinerary.entity';

export class ItineraryResponse {
  id: string;
  touristUserId: string;
  name: string;
  destinationCity: string;
  description: string | null;
  startDate: string;
  endDate: string;
  timezone: string;
  adultCount: number;
  childCount: number;
  budget: number | null;
  currency: string;
  status: ItineraryStatus;
  isAiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export class ItineraryListResponse {
  data: ItineraryResponse[];
  meta: { page: number; limit: number; total: number };
}
