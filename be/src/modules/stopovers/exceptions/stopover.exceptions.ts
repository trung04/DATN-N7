import { DomainException } from '../../../common/exceptions/domain.exception';

export class StopoverNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Stopover '${id}' was not found.`, 'STOPOVER_NOT_FOUND', 'not_found');
  }
}

export class StopoverOrderConflictException extends DomainException {
  constructor(itineraryId: string, stopOrder: number) {
    super(
      `Stop order '${stopOrder}' already exists for itinerary '${itineraryId}'.`,
      'STOPOVER_ORDER_CONFLICT',
      'conflict',
    );
  }
}

export class EmptyStopoverUpdateException extends DomainException {
  constructor() {
    super(
      'At least one stopover field must be provided.',
      'STOPOVER_UPDATE_EMPTY',
      'validation',
    );
  }
}

export class InvalidStopoverTimeRangeException extends DomainException {
  constructor() {
    super(
      'Stopover departure time must be after its arrival time.',
      'STOPOVER_TIME_RANGE_INVALID',
      'validation',
    );
  }
}

export class StopoverOutsideItineraryException extends DomainException {
  constructor() {
    super(
      'Stopover times must be within the itinerary date range.',
      'STOPOVER_OUTSIDE_ITINERARY',
      'validation',
    );
  }
}

export class StopoverScheduleConflictException extends DomainException {
  constructor(conflictingStopoverId: string) {
    super(
      `Stopover schedule overlaps stopover '${conflictingStopoverId}'.`,
      'STOPOVER_SCHEDULE_CONFLICT',
      'conflict',
    );
  }
}

export class StopoverDailyLimitException extends DomainException {
  constructor(date: string, limit: number) {
    super(
      `Itinerary day '${date}' cannot contain more than ${limit} stopovers.`,
      'STOPOVER_DAILY_LIMIT_EXCEEDED',
      'validation',
    );
  }
}

export class StopoverActivityRangeConflictException extends DomainException {
  constructor() {
    super(
      'Stopover times cannot exclude one or more existing activities.',
      'STOPOVER_ACTIVITY_RANGE_CONFLICT',
      'conflict',
    );
  }
}
