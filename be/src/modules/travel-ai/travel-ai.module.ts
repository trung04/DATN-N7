import { Module } from '@nestjs/common';
import { HotelsModule } from '../hotels/hotels.module';
import { PlacesModule } from '../places/places.module';
import { UsersModule } from '../users/users.module';
import { TravelAiController } from './controllers/travel-ai.controller';
import { FastApiTravelAiClient } from './integrations/ai/fastapi-travel-ai.client';
import { TRAVEL_AI } from './interfaces/travel-ai.integration';
import { PlaceSearchService } from './services/place-search.service';
import { TravelAiService } from './services/travel-ai.service';

@Module({
  imports: [HotelsModule, PlacesModule, UsersModule],
  controllers: [TravelAiController],
  providers: [
    PlaceSearchService,
    TravelAiService,
    { provide: TRAVEL_AI, useClass: FastApiTravelAiClient },
  ],
})
export class TravelAiModule {}
