import type { StopoversService } from '../../stopovers/services/stopovers.service';
import {
  ActivityOutsideStopoverException,
  ActivityScheduleConflictException,
  InvalidActivityTimeRangeException,
} from '../exceptions/activity.exceptions';
import type { ActivityRepository } from '../interfaces/activity.repository.interface';
import { ActivitiesService } from './activities.service';

describe('ActivitiesService', () => {
  const repository: jest.Mocked<ActivityRepository> = {
    findByIdAndStopoverId: jest.fn(),
    findByStopoverId: jest.fn(),
    findPage: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const stopoversService = { findByIdForTourist: jest.fn() };
  const service = new ActivitiesService(
    repository,
    stopoversService as unknown as StopoversService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    stopoversService.findByIdForTourist.mockResolvedValue({
      arrivalTime: new Date('2026-12-01T01:00:00.000Z'),
      departureTime: new Date('2026-12-01T05:00:00.000Z'),
    });
    repository.findByStopoverId.mockResolvedValue([]);
    repository.create.mockImplementation(async (value) => value as never);
  });

  it('creates a normalized activity under an active stopover', async () => {
    await service.create(
      '11111111-1111-4111-8111-111111111111',
      {
        activityOrder: 1,
        name: ' Museum visit ',
        startTime: '2026-12-01T01:00:00.000Z',
        endTime: '2026-12-01T03:00:00.000Z',
        currency: 'vnd',
      },
      '33333333-3333-4333-8333-333333333333',
    );

    expect(repository.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: 'Museum visit', currency: 'VND' }),
    );
  });

  it('rejects an invalid activity time range', async () => {
    await expect(
      service.create(
        '11111111-1111-4111-8111-111111111111',
        {
          activityOrder: 1,
          name: 'Museum',
          startTime: '2026-12-01T03:00:00.000Z',
          endTime: '2026-12-01T03:00:00.000Z',
          currency: 'VND',
        },
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toBeInstanceOf(InvalidActivityTimeRangeException);
  });

  it('rejects an activity outside its stopover', async () => {
    await expect(
      service.create(
        '11111111-1111-4111-8111-111111111111',
        {
          activityOrder: 1,
          name: 'Early museum visit',
          startTime: '2026-12-01T00:00:00.000Z',
          endTime: '2026-12-01T02:00:00.000Z',
          currency: 'VND',
        },
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toBeInstanceOf(ActivityOutsideStopoverException);
  });

  it('rejects an overlapping activity', async () => {
    repository.findByStopoverId.mockResolvedValue([
      {
        id: 'existing-activity',
        startTime: new Date('2026-12-01T02:00:00.000Z'),
        endTime: new Date('2026-12-01T03:00:00.000Z'),
        activityOrder: 1,
      } as never,
    ]);

    await expect(
      service.create(
        '11111111-1111-4111-8111-111111111111',
        {
          activityOrder: 2,
          name: 'Second museum visit',
          startTime: '2026-12-01T02:30:00.000Z',
          endTime: '2026-12-01T04:00:00.000Z',
          currency: 'VND',
        },
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toBeInstanceOf(ActivityScheduleConflictException);
  });
});
