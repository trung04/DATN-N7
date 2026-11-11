import { CancellationPolicyEntity } from '../entities/cancellation-policy.entity';

export const CANCELLATION_POLICY_REPOSITORY = Symbol(
  'CANCELLATION_POLICY_REPOSITORY',
);

export type CancellationPolicySortField =
  'name' | 'cancellationWindow' | 'cancellationFeeRate';

export interface FindCancellationPoliciesOptions {
  page: number;
  limit: number;
  search?: string;
  hotelId?: string;
  sortBy: CancellationPolicySortField;
  sortOrder: 'ASC' | 'DESC';
}

export interface CancellationPolicyPage {
  items: CancellationPolicyEntity[];
  total: number;
}

export interface CreateCancellationPolicyData {
  hotelId: string;
  name: string;
  cancellationWindow: number | null;
  minHoursBeforeCheckIn: number;
  maxHoursBeforeCheckIn: number | null;
  cancellationFeeRate: number | null;
  description: string | null;
}

export interface CancellationPolicyRepository {
  findById(id: string): Promise<CancellationPolicyEntity | null>;
  findByHotelAndName(
    hotelId: string,
    name: string,
  ): Promise<CancellationPolicyEntity | null>;
  findAllByHotel(hotelId: string): Promise<CancellationPolicyEntity[]>;
  findPage(
    options: FindCancellationPoliciesOptions,
  ): Promise<CancellationPolicyPage>;
  create(data: CreateCancellationPolicyData): Promise<CancellationPolicyEntity>;
  save(policy: CancellationPolicyEntity): Promise<CancellationPolicyEntity>;
  delete(policy: CancellationPolicyEntity): Promise<void>;
}
