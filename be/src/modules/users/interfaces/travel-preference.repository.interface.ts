export const TRAVEL_PREFERENCE_REPOSITORY = Symbol(
  'TRAVEL_PREFERENCE_REPOSITORY',
);

export interface SaveTravelPreferenceData {
  userId: string;
  categoryCodes: string[];
  topicCodes: string[];
  budget: number;
  style: string;
  transport: string;
  destinations: string[];
}

export interface TravelPreferenceData {
  userId: string;
  categories: Array<{ code: string; name: string }>;
  topics: Array<{ code: string; name: string }>;
  budget: number;
  style: string;
  transport: string;
  destinations: string[];
  updatedAt: Date;
}

export interface TravelPreferenceRepository {
  findByUserId(userId: string): Promise<TravelPreferenceData | null>;
  save(data: SaveTravelPreferenceData): Promise<TravelPreferenceData>;
  deleteByUserId(userId: string): Promise<void>;
}
