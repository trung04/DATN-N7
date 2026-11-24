import { getMetadataArgsStorage } from 'typeorm';
import { ImageEntity } from '../../media/entities/image.entity';
import { AdminEntity } from './admin.entity';
import { HotelOwnerEntity } from './hotel-owner.entity';
import { TopicEntity } from './topic.entity';
import { TouristEntity } from './tourist.entity';
import { TravelPreferenceTopicEntity } from './travel-preference-topic.entity';
import { TravelPreferenceEntity } from './travel-preference.entity';
import { UserImageEntity } from './user-image.entity';

const tableName = (target: Function): string | undefined =>
  getMetadataArgsStorage().tables.find((table) => table.target === target)
    ?.name;

describe('User domain entities', () => {
  it.each([
    [AdminEntity, 'admins'],
    [TouristEntity, 'tourists'],
    [HotelOwnerEntity, 'hotel_owners'],
    [TopicEntity, 'topics'],
    [TravelPreferenceEntity, 'travel_preferences'],
    [TravelPreferenceTopicEntity, 'travel_preference_topics'],
    [ImageEntity, 'images'],
    [UserImageEntity, 'user_images'],
  ])('maps %p to %s', (entity, table) => {
    expect(tableName(entity)).toBe(table);
  });
});
