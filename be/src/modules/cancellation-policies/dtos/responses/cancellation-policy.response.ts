export class CancellationPolicyResponse {
  id: string;
  hotelId: string;
  name: string;
  cancellationWindow: number | null;
  minHoursBeforeCheckIn: number;
  maxHoursBeforeCheckIn: number | null;
  cancellationFeeRate: number | null;
  description: string | null;
}

export class CancellationPolicyListResponse {
  data: CancellationPolicyResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
