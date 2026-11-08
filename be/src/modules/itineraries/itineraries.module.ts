import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { ItinerariesController } from './controllers/itineraries.controller';
import { ItineraryEntity } from './entities/itinerary.entity';
import { ITINERARY_REPOSITORY } from './interfaces/itinerary.repository.interface';
import { TypeOrmItineraryRepository } from './repositories/typeorm-itinerary.repository';
import { ItinerariesService } from './services/itineraries.service';

@Module({
  imports: [TypeOrmModule.forFeature([ItineraryEntity]), UsersModule],
  controllers: [ItinerariesController],
  providers: [
    ItinerariesService,
    {
      provide: ITINERARY_REPOSITORY,
      useClass: TypeOrmItineraryRepository,
    },
  ],
  exports: [ItinerariesService],
})
export class ItinerariesModule {}
