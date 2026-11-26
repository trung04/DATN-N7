export const TRAVEL_AI = Symbol('TRAVEL_AI');

export interface RecommendInput {
  userId: string;
  query: string;
  preferences: string[];
  personalized: boolean;
}

export interface Recommendation {
  placeId: string;
  type: 'Hotel' | 'Restaurant' | 'Attraction';
  city: string;
  score: number;
  reasons: string[];
}

export interface PlanInput {
  userId: string;
  city: string;
  startDate: string;
  days: number;
  guests: number;
  preferences: string[];
  query: string;
  stopsPerDay: number;
}

export interface PlanPreview {
  id: string;
  startDate: string;
  partySize: number;
  summary: string;
  warnings: string[];
  days: Array<{
    date: string;
    activities: Array<{
      placeId: string;
      start: string;
      end: string;
      notes: string[];
    }>;
  }>;
}

export interface PlaceSearchInput {
  query: string;
  city?: string;
  category?: string;
  sortBy: 'relevance' | 'name' | 'rating';
  sortOrder: 'ASC' | 'DESC';
  offset: number;
  limit: number;
}

export interface PlaceSearchPage {
  ids: string[];
  total: number;
  usedSemanticRanking: boolean;
}

export interface TravelAiIntegration {
  recommend(input: RecommendInput): Promise<Recommendation[]>;
  preview(input: PlanInput): Promise<PlanPreview>;
  searchPlaces(input: PlaceSearchInput): Promise<PlaceSearchPage>;
}
