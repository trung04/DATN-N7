import { ActivitiesController } from '../activities/controllers/activities.controller';
import { ItinerariesController } from '../itineraries/controllers/itineraries.controller';
import { StopoversController } from '../stopovers/controllers/stopovers.controller';
import { UserRole } from '../users/entities/user.entity';
import { ROLES_KEY } from './decorators/roles.decorator';

describe('Itinerary management roles', () => {
  it.each([
    ItinerariesController,
    StopoversController,
    ActivitiesController,
  ])('allows only tourists on %p', (controller) => {
    expect(Reflect.getMetadata(ROLES_KEY, controller)).toEqual([
      UserRole.TOURIST,
    ]);
  });
});
