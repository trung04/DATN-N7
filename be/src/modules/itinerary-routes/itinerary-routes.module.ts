import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItinerariesModule } from '../itineraries/itineraries.module';
import { PlacesModule } from '../places/places.module';
import { StopoversModule } from '../stopovers/stopovers.module';
import { ItineraryRoutesController } from './controllers/itinerary-routes.controller';
import { ItineraryRouteEntity } from './entities/itinerary-route.entity';
import { MapboxDirectionsClient } from './integrations/mapbox/mapbox-directions.client';
import { DIRECTIONS_PROVIDER } from './interfaces/directions-provider.interface';
import { ITINERARY_ROUTE_REPOSITORY } from './interfaces/itinerary-route.repository.interface';
import { TypeOrmItineraryRouteRepository } from './repositories/typeorm-itinerary-route.repository';
import { ItineraryRouteExpiryService } from './services/itinerary-route-expiry.service';
import { ItineraryRoutesService } from './services/itinerary-routes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ItineraryRouteEntity]),
    ItinerariesModule,
    StopoversModule,
    PlacesModule,
  ],
  controllers: [ItineraryRoutesController],
  providers: [
    ItineraryRoutesService,
    ItineraryRouteExpiryService,
    {
      provide: ITINERARY_ROUTE_REPOSITORY,
      useClass: TypeOrmItineraryRouteRepository,
    },
    {
      provide: DIRECTIONS_PROVIDER,
      useClass: MapboxDirectionsClient,
    },
  ],
})
export class ItineraryRoutesModule {}
