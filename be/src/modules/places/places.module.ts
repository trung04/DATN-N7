import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlacesController } from './controllers/places.controller';
import { PlaceEntity } from './entities/place.entity';
import { PLACE_REPOSITORY } from './interfaces/place.repository.interface';
import { TypeOrmPlaceRepository } from './repositories/typeorm-place.repository';
import { PlacesService } from './services/places.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlaceEntity])],
  controllers: [PlacesController],
  providers: [
    PlacesService,
    {
      provide: PLACE_REPOSITORY,
      useClass: TypeOrmPlaceRepository,
    },
  ],
  exports: [PlacesService],
})
export class PlacesModule {}
