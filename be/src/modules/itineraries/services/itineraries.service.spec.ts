import type { UsersService } from '../../users/services/users.service';
import { ItineraryStatus } from '../entities/itinerary.entity';
import { InvalidItineraryDateRangeException } from '../exceptions/itinerary.exceptions';
import type { ItineraryRepository } from '../interfaces/itinerary.repository.interface';
import { ItinerariesService } from './itineraries.service';

describe('ItinerariesService', () => {
  const repository: jest.Mocked<ItineraryRepository> = {
    findById: jest.fn(),
    findPage: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const usersService = { findById: jest.fn() };
  const service = new ItinerariesService(
    repository,
    usersService as unknown as UsersService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('validates the user and creates a normalized itinerary', async () => {
    usersService.findById.mockResolvedValue({});
    repository.create.mockImplementation(async (value) => value as never);

    await service.create({
      touristUserId: '11111111-1111-4111-8111-111111111111',
      name: ' Central Vietnam ',
      startDate: '2026-12-01',
      endDate: '2026-12-05',
      timezone: 'Asia/Ho_Chi_Minh',
      adultCount: 2,
      childCount: 0,
      currency: 'vnd',
      status: ItineraryStatus.DRAFT,
    });

    expect(usersService.findById).toHaveBeenCalled();
    expect(repository.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        name: 'Central Vietnam',
        currency: 'VND',
        isAiGenerated: false,
      }),
    );
  });

  it('rejects an inverted date range', async () => {
    usersService.findById.mockResolvedValue({});
    await expect(
      service.create({
        touristUserId: '11111111-1111-4111-8111-111111111111',
        name: 'Trip',
        startDate: '2026-12-05',
        endDate: '2026-12-01',
        timezone: 'Asia/Ho_Chi_Minh',
        adultCount: 1,
        childCount: 0,
        currency: 'VND',
        status: ItineraryStatus.DRAFT,
      }),
    ).rejects.toBeInstanceOf(InvalidItineraryDateRangeException);
  });
});
