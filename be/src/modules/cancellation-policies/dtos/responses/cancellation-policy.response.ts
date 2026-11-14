export class CancellationPolicyResponse {
  id: string;
  hotelId: string;
  name: string;
  cancelHours: number;
  penaltyPercent: number;
  cancellationAllowed: boolean;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CancellationPolicyScheduleResponse {
  hotelId: string;
  version: string;
  complete: boolean;
  issue: string | null;
  rules: CancellationPolicyScheduleRuleResponse[];
}

export class CancellationPolicyScheduleRuleResponse {
  id: string;
  name: string;
  cancelHours: number;
  penaltyPercent: number;
  cancellationAllowed: boolean;
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
