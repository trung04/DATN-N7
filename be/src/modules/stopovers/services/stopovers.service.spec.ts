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
  const itinerariesService = {
    findById: jest.fn(),
    findByIdForTourist: jest.fn(),
  };
  const service = new StopoversService(
    repository,
    itinerariesService as unknown as ItinerariesService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates an ordered stopover under an active itinerary', async () => {
    itinerariesService.findByIdForTourist.mockResolvedValue({});
    repository.findByItineraryAndOrder.mockResolvedValue(null);
    repository.create.mockImplementation(async (value) => value as never);

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
    itinerariesService.findByIdForTourist.mockResolvedValue({});
    repository.findByItineraryAndOrder.mockResolvedValue(null);
    repository.create.mockImplementation(async (value) => value as never);

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

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      placeId: null,
      customName: 'Bà Nà – Suối Mơ',
      customAddress: 'Hòa Vang, Đà Nẵng, Việt Nam',
      latitude: 15.9971,
      longitude: 107.9962,
    }));
  });

  it('rejects departure at or before arrival', async () => {
    itinerariesService.findByIdForTourist.mockResolvedValue({});
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
});
