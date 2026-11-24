import { getMetadataArgsStorage } from 'typeorm';
import { PlaceCategoryMappingEntity } from './place-category-mapping.entity';
import { PlaceCategoryEntity } from './place-category.entity';
import { PlaceImageEntity } from './place-image.entity';
import { PlaceTopicEntity } from './place-topic.entity';
import { PlaceEntity } from './place.entity';
import { ReferencePriceEntity } from './reference-price.entity';

const tableName = (target: Function): string | undefined =>
  getMetadataArgsStorage().tables.find((table) => table.target === target)
    ?.name;

describe('Place domain entities', () => {
  it.each([
    [PlaceEntity, 'places'],
    [PlaceCategoryEntity, 'place_categories'],
    [PlaceCategoryMappingEntity, 'place_category_mappings'],
    [PlaceTopicEntity, 'place_topics'],
    [PlaceImageEntity, 'place_images'],
    [ReferencePriceEntity, 'reference_prices'],
  ])('maps %p to %s', (entity, table) => {
    expect(tableName(entity)).toBe(table);
  });
});
