import type { PlanTravelRequest } from '../requests/travel-ai.request';

export interface TravelRecommendationResponse {
  id: string;
  type: 'destination' | 'hotel';
  name: string;
  city: string;
  price: number | null;
  tags: string[];
  description: string;
  score: number;
  reason: string;
}

export interface TravelPlanResponse {
  trip: {
    id: string;
    userId: string;
    name: string;
    city: string;
    startDate: string;
    endDate: string;
    adults: number;
    children: number;
    budget: number;
    note: string;
    status: 'DRAFT';
    source: 'demo-planner';
  };
  stops: Array<{
    id: string;
    tripId: string;
    placeId: string;
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    start: string;
    end: string;
    order: number;
    note: string;
  }>;
  activities: Array<{
    id: string;
    stopId: string;
    placeId: string;
    name: string;
    start: string;
    end: string;
    order: number;
    note: string;
    cost: null;
  }>;
  totalCost: null;
  explanation: string;
  warnings: string[];
  input: PlanTravelRequest;
}
