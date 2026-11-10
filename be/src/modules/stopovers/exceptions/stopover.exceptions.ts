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
