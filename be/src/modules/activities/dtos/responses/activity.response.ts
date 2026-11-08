export class ActivityResponse {
  id: string;
  stopoverId: string;
  activityOrder: number;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  estimatedCost: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export class ActivityListResponse {
  data: ActivityResponse[];
  meta: { page: number; limit: number; total: number };
}
