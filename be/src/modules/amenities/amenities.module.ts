import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AmenitiesController } from './controllers/amenities.controller';
import { AmenityEntity } from './entities/amenity.entity';
import { AMENITY_REPOSITORY } from './interfaces/amenity.repository.interface';
import { TypeOrmAmenityRepository } from './repositories/typeorm-amenity.repository';
import { AmenitiesService } from './services/amenities.service';

@Module({
  imports: [TypeOrmModule.forFeature([AmenityEntity])],
  controllers: [AmenitiesController],
  providers: [
    AmenitiesService,
    {
      provide: AMENITY_REPOSITORY,
      useClass: TypeOrmAmenityRepository,
    },
  ],
})
export class AmenitiesModule {}
