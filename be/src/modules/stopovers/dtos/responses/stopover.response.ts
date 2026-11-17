export class StopoverResponse {
  id: string;
  itineraryId: string;
  placeId: string | null;
  customName: string | null;
  customAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  stopOrder: number;
  arrivalTime: string;
  departureTime: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export class StopoverListResponse {
  data: StopoverResponse[];
  meta: { page: number; limit: number; total: number };
}
