import type { ItinerariesService } from '../../itineraries/services/itineraries.service';
import {
  InvalidStopoverTimeRangeException,
  StopoverActivityRangeConflictException,
  StopoverDailyLimitException,
  StopoverOutsideItineraryException,
  StopoverScheduleConflictException,
} from '../exceptions/stopover.exceptions';
import type { StopoverRepository } from '../interfaces/stopover.repository.interface';
import { StopoversService } from './stopovers.service';

describe('StopoversService', () => {
  const itinerary = {
    id: '11111111-1111-4111-8111-111111111111',
    startDate: '2026-12-01',
    endDate: '2026-12-03',
    timezone: 'Asia/Ho_Chi_Minh',
  };
  const repository: jest.Mocked<StopoverRepository> = {
    findById: jest.fn(),
    findByIdAndItineraryId: jest.fn(),
    findByItineraryId: jest.fn(),
    hasActivitiesOutsideRange: jest.fn(),
    findPage: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const itinerariesService = {
    findById: jest.fn(),
    findByIdForTourist: jest.fn(),
  };
  const service = new StopoversService(
    repository,
    itinerariesService as unknown as ItinerariesService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    itinerariesService.findByIdForTourist.mockResolvedValue(itinerary);
    repository.findByItineraryId.mockResolvedValue([]);
    repository.hasActivitiesOutsideRange.mockResolvedValue(false);
    repository.create.mockImplementation(async (value) => value as never);
  });

  it('creates an ordered stopover under an active itinerary', async () => {
    await service.create(
      '11111111-1111-4111-8111-111111111111',
      {
        placeId: '22222222-2222-4222-8222-222222222222',
        stopOrder: 1,
        arrivalTime: '2026-12-01T01:00:00.000Z',
        departureTime: '2026-12-01T03:00:00.000Z',
      },
      '33333333-3333-4333-8333-333333333333',
    );

    expect(repository.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ stopOrder: 1 }),
    );
  });

  it('creates a custom stop with a confirmed permanent location', async () => {
    await service.create(
      '11111111-1111-4111-8111-111111111111',
      {
        customName: 'Bà Nà – Suối Mơ',
        customAddress: 'Hòa Vang, Đà Nẵng, Việt Nam',
        latitude: 15.9971,
        longitude: 107.9962,
        stopOrder: 1,
        arrivalTime: '2026-12-01T01:00:00.000Z',
        departureTime: '2026-12-01T03:00:00.000Z',
      },
      '33333333-3333-4333-8333-333333333333',
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        placeId: null,
        customName: 'Bà Nà – Suối Mơ',
        customAddress: 'Hòa Vang, Đà Nẵng, Việt Nam',
        latitude: 15.9971,
        longitude: 107.9962,
      }),
    );
  });

  it('rejects departure at or before arrival', async () => {
    await expect(
      service.create(
        '11111111-1111-4111-8111-111111111111',
        {
          placeId: '22222222-2222-4222-8222-222222222222',
          stopOrder: 1,
          arrivalTime: '2026-12-01T03:00:00.000Z',
          departureTime: '2026-12-01T01:00:00.000Z',
        },
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toBeInstanceOf(InvalidStopoverTimeRangeException);
  });

  it('accepts a cross-day stopover without a duration cap', async () => {
    await service.create(
      itinerary.id,
      {
        placeId: '22222222-2222-4222-8222-222222222222',
        stopOrder: 1,
        arrivalTime: '2026-12-01T13:00:00.000Z',
        departureTime: '2026-12-03T01:00:00.000Z',
      },
      '33333333-3333-4333-8333-333333333333',
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        arrivalTime: new Date('2026-12-01T13:00:00.000Z'),
        departureTime: new Date('2026-12-03T01:00:00.000Z'),
      }),
    );
  });

  it('rejects a stopover outside the itinerary local dates', async () => {
    await expect(
      service.create(
        itinerary.id,
        {
          placeId: '22222222-2222-4222-8222-222222222222',
          stopOrder: 1,
          arrivalTime: '2026-12-03T16:00:00.000Z',
          departureTime: '2026-12-03T18:00:00.000Z',
        },
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toBeInstanceOf(StopoverOutsideItineraryException);
  });

  it('rejects an overlapping stopover', async () => {
    repository.findByItineraryId.mockResolvedValue([
      {
        id: 'existing-stop',
        arrivalTime: new Date('2026-12-02T01:00:00.000Z'),
        departureTime: new Date('2026-12-02T03:00:00.000Z'),
        stopOrder: 1,
      } as never,
    ]);

    await expect(
      service.create(
        itinerary.id,
        {
          placeId: '22222222-2222-4222-8222-222222222222',
          stopOrder: 2,
          arrivalTime: '2026-12-02T02:00:00.000Z',
          departureTime: '2026-12-02T04:00:00.000Z',
        },
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toBeInstanceOf(StopoverScheduleConflictException);
  });

  it('limits each itinerary day to ten stopovers', async () => {
    repository.findByItineraryId.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        id: `stop-${index}`,
        arrivalTime: new Date(
          `2026-12-02T${String(index).padStart(2, '0')}:00:00.000Z`,
        ),
        departureTime: new Date(
          `2026-12-02T${String(index).padStart(2, '0')}:30:00.000Z`,
        ),
        stopOrder: index + 1,
      })) as never,
    );

    await expect(
      service.create(
        itinerary.id,
        {
          placeId: '22222222-2222-4222-8222-222222222222',
          stopOrder: 11,
          arrivalTime: '2026-12-02T10:00:00.000Z',
          departureTime: '2026-12-02T10:30:00.000Z',
        },
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toBeInstanceOf(StopoverDailyLimitException);
  });

  it('rejects shrinking a stopover around existing activities', async () => {
    const existing = {
      id: 'stop-1',
      itineraryId: itinerary.id,
      stopOrder: 1,
      arrivalTime: new Date('2026-12-02T01:00:00.000Z'),
      departureTime: new Date('2026-12-02T05:00:00.000Z'),
      placeId: '22222222-2222-4222-8222-222222222222',
      customName: null,
      customAddress: null,
      latitude: null,
      longitude: null,
      description: null,
    };
    repository.findByIdAndItineraryId.mockResolvedValue(existing as never);
    repository.findByItineraryId.mockResolvedValue([existing as never]);
    repository.hasActivitiesOutsideRange.mockResolvedValue(true);

    await expect(
      service.update(
        itinerary.id,
        'stop-1',
        { departureTime: '2026-12-02T03:00:00.000Z' },
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toBeInstanceOf(StopoverActivityRangeConflictException);
  });
});
