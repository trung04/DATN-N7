import type { PlaceCatalogOptions } from '../../places/interfaces/place.repository.interface';
import { PlacesService } from '../../places/services/places.service';
import type { TravelPreferenceRepository } from '../interfaces/travel-preference.repository.interface';
import { TravelPreferencesService } from './travel-preferences.service';

describe('TravelPreferencesService', () => {
  const options: PlaceCatalogOptions = {
    cities: [],
    categories: [{ code: 'ATTRACTION', name: 'Điểm tham quan' }],
    topics: [{ code: 'BEACH', name: 'Biển' }],
  };
  let repository: jest.Mocked<TravelPreferenceRepository>;
  let places: jest.Mocked<Pick<PlacesService, 'findPreferenceOptions'>>;
  let service: TravelPreferencesService;

  beforeEach(() => {
    repository = {
      findByUserId: jest.fn(),
      save: jest.fn(),
      deleteByUserId: jest.fn(),
    };
    places = { findPreferenceOptions: jest.fn().mockResolvedValue(options) };
    service = new (TravelPreferencesService as unknown as new (
      repository: TravelPreferenceRepository,
      places: Pick<PlacesService, 'findPreferenceOptions'>,
    ) => TravelPreferencesService)(repository, places);
  });

  it('saves category and topic codes from the active place catalog', async () => {
    repository.save.mockResolvedValue({
      userId: 'tourist-1',
      categories: options.categories,
      topics: options.topics,
      budget: 6_000_000,
      style: 'Cân bằng',
      transport: 'Máy bay',
      destinations: ['Đà Nẵng'],
      updatedAt: new Date('2026-11-25T00:00:00.000Z'),
    } as never);

    await expect(service.saveForUser('tourist-1', {
      categoryCodes: ['attraction'],
      topicCodes: ['beach'],
      budget: 6_000_000,
      style: 'Cân bằng',
      transport: 'Máy bay',
      destinations: ['Đà Nẵng'],
    } as never)).resolves.toMatchObject({
      categories: options.categories,
      topics: options.topics,
    });

    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      categoryCodes: ['ATTRACTION'],
      topicCodes: ['BEACH'],
    }));
  });

  it('returns only taxonomy values assigned to active places', async () => {
    await expect((service as unknown as { findOptions(): Promise<PlaceCatalogOptions> }).findOptions())
      .resolves.toEqual({ categories: options.categories, topics: options.topics });
    expect(places.findPreferenceOptions).toHaveBeenCalledTimes(1);
  });
});
