import { ItineraryEntity, ItineraryStatus } from '../entities/itinerary.entity';

export const ITINERARY_REPOSITORY = Symbol('ITINERARY_REPOSITORY');

export type ItinerarySortField =
  'name' | 'startDate' | 'endDate' | 'createdAt' | 'updatedAt';

export interface FindItinerariesOptions {
  page: number;
  limit: number;
  search?: string;
  touristUserId?: string;
  status?: ItineraryStatus;
  sortBy: ItinerarySortField;
  sortOrder: 'ASC' | 'DESC';
}

export interface ItineraryPage {
  items: ItineraryEntity[];
  total: number;
}

export interface CreateItineraryData {
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
}

export interface ItineraryRepository {
  findById(id: string): Promise<ItineraryEntity | null>;
  findPage(options: FindItinerariesOptions): Promise<ItineraryPage>;
  create(data: CreateItineraryData): Promise<ItineraryEntity>;
  save(itinerary: ItineraryEntity): Promise<ItineraryEntity>;
  delete(itinerary: ItineraryEntity): Promise<void>;
}
