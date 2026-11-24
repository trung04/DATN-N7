import { DomainException } from '../../../common/exceptions/domain.exception';

export class ActivityNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Activity '${id}' was not found.`, 'ACTIVITY_NOT_FOUND', 'not_found');
  }
}

export class ActivityOrderConflictException extends DomainException {
  constructor(stopoverId: string, activityOrder: number) {
    super(
      `Activity order '${activityOrder}' already exists for stopover '${stopoverId}'.`,
      'ACTIVITY_ORDER_CONFLICT',
      'conflict',
    );
  }
}

export class EmptyActivityUpdateException extends DomainException {
  constructor() {
    super(
      'At least one activity field must be provided.',
      'ACTIVITY_UPDATE_EMPTY',
      'validation',
    );
  }
}

export class InvalidActivityTimeRangeException extends DomainException {
  constructor() {
    super(
      'Activity end time must be after its start time.',
      'ACTIVITY_TIME_RANGE_INVALID',
      'validation',
    );
  }
}
