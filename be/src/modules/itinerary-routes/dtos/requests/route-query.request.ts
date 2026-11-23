import { IsDateString, IsEnum, Matches } from 'class-validator';
import { ItineraryRouteProfile } from '../../entities/itinerary-route.entity';

export class RouteQueryRequest {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  routeDate: string;

  @IsEnum(ItineraryRouteProfile)
  profile: ItineraryRouteProfile = ItineraryRouteProfile.DRIVING;
}
