import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlacesController } from './controllers/places.controller';
import { PlaceCategoryMappingEntity } from './entities/place-category-mapping.entity';
import { PlaceCategoryEntity } from './entities/place-category.entity';
import { PlaceImageEntity } from './entities/place-image.entity';
import { PlaceTopicEntity } from './entities/place-topic.entity';
import { PlaceEntity } from './entities/place.entity';
import { ReferencePriceEntity } from './entities/reference-price.entity';
import { PLACE_IMAGE_STORAGE, S3PlaceImageStorage } from './integrations/s3-place-image.storage';
import { PLACE_REPOSITORY } from './interfaces/place.repository.interface';
import { TypeOrmPlaceRepository } from './repositories/typeorm-place.repository';
import { PlacesService } from './services/places.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlaceEntity,
      PlaceCategoryEntity,
      PlaceCategoryMappingEntity,
      PlaceTopicEntity,
      PlaceImageEntity,
      ReferencePriceEntity,
    ]),
  ],
  controllers: [PlacesController],
  providers: [
    PlacesService,
    { provide: PLACE_IMAGE_STORAGE, useClass: S3PlaceImageStorage },
    {
      provide: PLACE_REPOSITORY,
      useClass: TypeOrmPlaceRepository,
    },
  ],
  exports: [PlacesService],
})
export class PlacesModule {}
