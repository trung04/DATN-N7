import type { StopoversService } from '../../stopovers/services/stopovers.service';
import { InvalidActivityTimeRangeException } from '../exceptions/activity.exceptions';
import type { ActivityRepository } from '../interfaces/activity.repository.interface';
import { ActivitiesService } from './activities.service';

describe('ActivitiesService', () => {
  const repository: jest.Mocked<ActivityRepository> = {
    findByIdAndStopoverId: jest.fn(),
    findByStopoverAndOrder: jest.fn(),
    findPage: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const stopoversService = { findById: jest.fn() };
  const service = new ActivitiesService(
    repository,
    stopoversService as unknown as StopoversService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a normalized activity under an active stopover', async () => {
    stopoversService.findById.mockResolvedValue({});
    repository.findByStopoverAndOrder.mockResolvedValue(null);
    repository.create.mockImplementation(async (value) => value as never);

    await service.create('11111111-1111-4111-8111-111111111111', {
      activityOrder: 1,
      name: ' Museum visit ',
      startTime: '2026-12-01T01:00:00.000Z',
      endTime: '2026-12-01T03:00:00.000Z',
      currency: 'vnd',
    });

    expect(repository.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: 'Museum visit', currency: 'VND' }),
    );
  });

  it('rejects an invalid activity time range', async () => {
    stopoversService.findById.mockResolvedValue({});
    await expect(
      service.create('11111111-1111-4111-8111-111111111111', {
        activityOrder: 1,
        name: 'Museum',
        startTime: '2026-12-01T03:00:00.000Z',
        endTime: '2026-12-01T03:00:00.000Z',
        currency: 'VND',
      }),
    ).rejects.toBeInstanceOf(InvalidActivityTimeRangeException);
  });
});
