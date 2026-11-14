import { CancellationPolicyEntity } from '../entities/cancellation-policy.entity';
import { UserRole } from '../../users/entities/user.entity';
import { HotelsService } from '../../hotels/services/hotels.service';
import {
  CancellationPolicyNameConflictException,
  CancellationPolicyNotFoundException,
  EmptyCancellationPolicyUpdateException,
} from '../exceptions/cancellation-policy.exceptions';
import type { CancellationPolicyRepository } from '../interfaces/cancellation-policy.repository.interface';
import { CancellationPoliciesService } from './cancellation-policies.service';

const hotelId = '11111111-1111-4111-8111-111111111111';
const policyId = '22222222-2222-4222-8222-222222222222';
const ownerActor = {
  id: '33333333-3333-4333-8333-333333333333',
  role: UserRole.HOTEL_OWNER,
};

const policy = (
  overrides: Partial<CancellationPolicyEntity> = {},
): CancellationPolicyEntity =>
  Object.assign(new CancellationPolicyEntity(), {
    id: policyId,
    hotelId,
    name: 'Flexible',
    cancelHours: 24,
    penaltyPercent: 10,
    cancellationAllowed: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    description: 'Cancel up to two days before check-in.',
    ...overrides,
  });

describe('CancellationPoliciesService', () => {
  let repository: jest.Mocked<CancellationPolicyRepository>;
  let service: CancellationPoliciesService;
  let hotelsService: jest.Mocked<
    Pick<HotelsService, 'assertActive' | 'assertManagedBy'>
  >;
  let createPolicy: jest.MockedFunction<CancellationPolicyRepository['create']>;
  let savePolicy: jest.MockedFunction<CancellationPolicyRepository['save']>;

  beforeEach(() => {
    createPolicy = jest.fn();
    savePolicy = jest.fn();
    repository = {
      findById: jest.fn(),
      findByHotelAndName: jest.fn(),
      findAllByHotel: jest.fn().mockResolvedValue([]),
      findActiveByHotel: jest.fn().mockResolvedValue(null),
      findPage: jest.fn(),
      create: createPolicy,
      save: savePolicy,
      delete: jest.fn(),
    };
    hotelsService = { assertActive: jest.fn(), assertManagedBy: jest.fn() };
    service = new CancellationPoliciesService(
      repository,
      hotelsService as unknown as HotelsService,
    );
  });

  it('normalizes and creates a policy for a hotel', async () => {
    const saved = policy();
    repository.findByHotelAndName.mockResolvedValue(null);
    createPolicy.mockResolvedValue(saved);

    await expect(
      service.create(
        {
          hotelId,
          name: ' Flexible ',
          cancelHours: 24,
          penaltyPercent: 10,
          description: ' Cancel up to two days before check-in. ',
        },
        ownerActor,
      ),
    ).resolves.toBe(saved);

    expect(createPolicy).toHaveBeenCalledWith({
      hotelId,
      name: 'Flexible',
      cancelHours: 24,
      penaltyPercent: 10,
      cancellationAllowed: true,
      isActive: true,
      description: 'Cancel up to two days before check-in.',
    });
  });

  it('rejects a duplicate policy name in the same hotel', async () => {
    repository.findByHotelAndName.mockResolvedValue(policy());

    await expect(
      service.create({
        hotelId,
        name: 'Flexible',
        cancelHours: 24,
        penaltyPercent: 10,
      }, ownerActor),
    ).rejects.toBeInstanceOf(CancellationPolicyNameConflictException);
    expect(createPolicy).not.toHaveBeenCalled();
  });

  it('updates policy values', async () => {
    const existing = policy();
    repository.findById.mockResolvedValue(existing);
    savePolicy.mockImplementation(async (value) => value);

    const updated = await service.update(
      policyId,
      {
        cancelHours: 12,
        penaltyPercent: 15,
      },
      ownerActor,
    );

    expect(updated.cancelHours).toBe(12);
    expect(updated.penaltyPercent).toBe(15);
    expect(savePolicy).toHaveBeenCalledWith(existing);
  });

  it('rejects an empty update', async () => {
    await expect(
      service.update(policyId, {}, ownerActor),
    ).rejects.toBeInstanceOf(EmptyCancellationPolicyUpdateException);
  });

  it('rejects reading a missing policy', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findById(policyId)).rejects.toBeInstanceOf(
      CancellationPolicyNotFoundException,
    );
  });
});
import { HotelsService } from '../../hotels/services/hotels.service';
