import { DomainException } from '../../../common/exceptions/domain.exception';

export class ItineraryNotFoundException extends DomainException {
  constructor(id: string) {
    super(
      `Itinerary '${id}' was not found.`,
      'ITINERARY_NOT_FOUND',
      'not_found',
    );
  }
}

export class EmptyItineraryUpdateException extends DomainException {
  constructor() {
    super(
      'At least one itinerary field must be provided.',
      'ITINERARY_UPDATE_EMPTY',
      'validation',
    );
  }
}

export class InvalidItineraryDateRangeException extends DomainException {
  constructor() {
    super(
      'Itinerary end date must be on or after its start date.',
      'ITINERARY_DATE_RANGE_INVALID',
      'validation',
    );
  }
}
