import { PlaceTaxonomyInUseException } from '../exceptions/place.exceptions';
import type { PlaceTaxonomyRepository } from '../interfaces/place-taxonomy.repository.interface';
import { PlaceTaxonomiesService } from './place-taxonomies.service';

describe('PlaceTaxonomiesService', () => {
  let repository: jest.Mocked<PlaceTaxonomyRepository>;
  let service: PlaceTaxonomiesService;

  beforeEach(() => {
    repository = {
      list: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      countReferences: jest.fn(),
      delete: jest.fn(),
    };
    service = new PlaceTaxonomiesService(repository);
  });

  it('normalizes immutable taxonomy codes when an admin creates a category', async () => {
    repository.findByCode.mockResolvedValue(null);
    repository.create.mockImplementation(async (_kind, input) => ({
      id: 'category-1', code: input.code, name: input.name, description: input.description ?? null,
    }));

    await service.create('category', {
      code: ' attraction ', name: ' Điểm tham quan ', description: ' Danh thắng ',
    });

    expect(repository.create).toHaveBeenCalledWith('category', {
      code: 'ATTRACTION', name: 'Điểm tham quan', description: 'Danh thắng',
    });
  });

  it('rejects deleting a topic that is still assigned to places or preferences', async () => {
    repository.findById.mockResolvedValue({
      id: 'topic-1', code: 'BEACH', name: 'Biển', description: null,
    });
    repository.countReferences.mockResolvedValue({ places: 2, preferences: 1 });

    await expect(service.delete('topic', 'topic-1'))
      .rejects.toBeInstanceOf(PlaceTaxonomyInUseException);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
