import { StopoverEntity } from '../entities/stopover.entity';

export const STOPOVER_REPOSITORY = Symbol('STOPOVER_REPOSITORY');

export type StopoverSortField =
  'stopOrder' | 'arrivalTime' | 'departureTime' | 'createdAt';

export interface FindStopoversOptions {
  itineraryId: string;
  page: number;
  limit: number;
  sortBy: StopoverSortField;
  sortOrder: 'ASC' | 'DESC';
}

export interface StopoverPage {
  items: StopoverEntity[];
  total: number;
}

export interface CreateStopoverData {
  itineraryId: string;
  placeId: string | null;
  customName: string | null;
  customAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  stopOrder: number;
  arrivalTime: Date;
  departureTime: Date;
  description: string | null;
}

export interface StopoverRepository {
  findById(id: string): Promise<StopoverEntity | null>;
  findByIdAndItineraryId(
    id: string,
    itineraryId: string,
  ): Promise<StopoverEntity | null>;
  findByItineraryId(itineraryId: string): Promise<StopoverEntity[]>;
  hasActivitiesOutsideRange(
    stopoverId: string,
    arrivalTime: Date,
    departureTime: Date,
  ): Promise<boolean>;
  findPage(options: FindStopoversOptions): Promise<StopoverPage>;
  create(data: CreateStopoverData): Promise<StopoverEntity>;
  save(stopover: StopoverEntity): Promise<StopoverEntity>;
  delete(stopover: StopoverEntity): Promise<void>;
}
