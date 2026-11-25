import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { TopicEntity } from '../entities/topic.entity';
import { TravelPreferenceEntity } from '../entities/travel-preference.entity';
import { TravelPreferenceTopicEntity } from '../entities/travel-preference-topic.entity';
import { TravelPreferenceCategoryEntity } from '../entities/travel-preference-category.entity';
import { PlaceCategoryEntity } from '../../places/entities/place-category.entity';
import type {
  SaveTravelPreferenceData,
  TravelPreferenceData,
  TravelPreferenceRepository,
} from '../interfaces/travel-preference.repository.interface';

@Injectable()
export class TypeOrmTravelPreferenceRepository implements TravelPreferenceRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TravelPreferenceEntity)
    private readonly preferences: Repository<TravelPreferenceEntity>,
    @InjectRepository(TravelPreferenceTopicEntity)
    private readonly preferenceTopics: Repository<TravelPreferenceTopicEntity>,
    @InjectRepository(TravelPreferenceCategoryEntity)
    private readonly preferenceCategories: Repository<TravelPreferenceCategoryEntity>,
    @InjectRepository(TopicEntity)
    private readonly topics: Repository<TopicEntity>,
  ) {}

  async findByUserId(userId: string): Promise<TravelPreferenceData | null> {
    const preference = await this.preferences.findOneBy({ userId });
    if (!preference) return null;

    const topicMappings = await this.preferenceTopics.findBy({
      travelPreferenceUserId: userId,
    });
    const categoryMappings = await this.preferenceCategories.findBy({
      travelPreferenceUserId: userId,
    });
    const topicIds = topicMappings.map((mapping) => mapping.topicId);
    const categoryIds = categoryMappings.map((mapping) => mapping.placeCategoryId);
    const topics = topicIds.length ? await this.topics.findBy({ id: In(topicIds) }) : [];
    const categories = categoryIds.length
      ? await this.dataSource.getRepository(PlaceCategoryEntity).findBy({ id: In(categoryIds) })
      : [];

    return {
      userId,
      categories: categories
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ code, name }) => ({ code, name })),
      topics: topics
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ code, name }) => ({ code, name })),
      budget: preference.maxBudget ?? 0,
      style: preference.travelStyle,
      transport: preference.preferredTransport,
      destinations: preference.preferredDestinations,
      updatedAt: preference.updatedAt,
    };
  }

  async save(data: SaveTravelPreferenceData): Promise<TravelPreferenceData> {
    await this.dataSource.transaction(async (manager) => {
      const preferenceRepository = manager.getRepository(TravelPreferenceEntity);
      const mappingRepository = manager.getRepository(TravelPreferenceTopicEntity);
      const categoryMappingRepository = manager.getRepository(TravelPreferenceCategoryEntity);
      const topicRepository = manager.getRepository(TopicEntity);
      const categoryRepository = manager.getRepository(PlaceCategoryEntity);

      const preference = await preferenceRepository.findOne({
        where: { userId: data.userId },
        withDeleted: true,
      });
      if (preference?.deletedAt) {
        await preferenceRepository.restore({ userId: data.userId });
        preference.deletedAt = null;
      }

      const activePreference =
        preference && !preference.deletedAt
          ? preference
          : preferenceRepository.create({ userId: data.userId });
      activePreference.minBudget = null;
      activePreference.maxBudget = data.budget;
      activePreference.currency = 'VND';
      activePreference.travelStyle = data.style;
      activePreference.preferredTransport = data.transport;
      activePreference.preferredDestinations = data.destinations;
      await preferenceRepository.save(activePreference);

      await mappingRepository.softDelete({ travelPreferenceUserId: data.userId });
      await categoryMappingRepository.softDelete({ travelPreferenceUserId: data.userId });
      if (data.topicCodes.length) {
        const topics = await topicRepository.findBy({ code: In(data.topicCodes) });
        if (topics.length !== data.topicCodes.length) {
          throw new Error('Travel interest catalog is missing configured topics.');
        }
        await mappingRepository.save(
          topics.map((topic) =>
            mappingRepository.create({
              travelPreferenceUserId: data.userId,
              topicId: topic.id,
            }),
          ),
        );
      }
      if (data.categoryCodes.length) {
        const categories = await categoryRepository.findBy({ code: In(data.categoryCodes) });
        if (categories.length !== data.categoryCodes.length) {
          throw new Error('Travel preference catalog is missing configured categories.');
        }
        await categoryMappingRepository.save(
          categories.map((category) =>
            categoryMappingRepository.create({
              travelPreferenceUserId: data.userId,
              placeCategoryId: category.id,
            }),
          ),
        );
      }
    });

    const saved = await this.findByUserId(data.userId);
    if (!saved) throw new Error('Saved travel preference could not be reloaded.');
    return saved;
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(TravelPreferenceTopicEntity)
        .softDelete({ travelPreferenceUserId: userId });
      await manager
        .getRepository(TravelPreferenceCategoryEntity)
        .softDelete({ travelPreferenceUserId: userId });
      await manager
        .getRepository(TravelPreferenceEntity)
        .softDelete({ userId });
    });
  }
}
