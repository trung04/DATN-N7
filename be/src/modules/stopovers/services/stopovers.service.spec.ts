import type { ItinerariesService } from '../../itineraries/services/itineraries.service';
import { InvalidStopoverTimeRangeException } from '../exceptions/stopover.exceptions';
import type { StopoverRepository } from '../interfaces/stopover.repository.interface';
import { StopoversService } from './stopovers.service';

describe('StopoversService', () => {
  const repository: jest.Mocked<StopoverRepository> = {
    findById: jest.fn(),
    findByIdAndItineraryId: jest.fn(),
    findByItineraryAndOrder: jest.fn(),
    findPage: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const itinerariesService = { findById: jest.fn() };
  const service = new StopoversService(
    repository,
    itinerariesService as unknown as ItinerariesService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates an ordered stopover under an active itinerary', async () => {
    itinerariesService.findById.mockResolvedValue({});
    repository.findByItineraryAndOrder.mockResolvedValue(null);
    repository.create.mockImplementation(async (value) => value as never);

    await service.create('11111111-1111-4111-8111-111111111111', {
      placeId: '22222222-2222-4222-8222-222222222222',
      stopOrder: 1,
      arrivalTime: '2026-12-01T01:00:00.000Z',
      departureTime: '2026-12-01T03:00:00.000Z',
    });

    expect(repository.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ stopOrder: 1 }),
    );
  });

  it('rejects departure at or before arrival', async () => {
    itinerariesService.findById.mockResolvedValue({});
    await expect(
      service.create('11111111-1111-4111-8111-111111111111', {
        placeId: '22222222-2222-4222-8222-222222222222',
        stopOrder: 1,
        arrivalTime: '2026-12-01T03:00:00.000Z',
        departureTime: '2026-12-01T01:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(InvalidStopoverTimeRangeException);
  });
});
