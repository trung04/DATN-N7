import { DomainException } from '../../../common/exceptions/domain.exception';

export class ReviewNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Review '${id}' was not found.`, 'REVIEW_NOT_FOUND', 'not_found');
  }
}

export class ReviewBookingNotFoundException extends DomainException {
  constructor() {
    super('Booking was not found.', 'REVIEW_BOOKING_NOT_FOUND', 'not_found');
  }
}

export class ReviewBookingNotCompletedException extends DomainException {
  constructor() {
    super(
      'Only completed bookings can be reviewed.',
      'REVIEW_BOOKING_NOT_COMPLETED',
      'conflict',
    );
  }
}

export class DuplicateBookingReviewException extends DomainException {
  constructor() {
    super(
      'This booking already has a review.',
      'BOOKING_REVIEW_ALREADY_EXISTS',
      'conflict',
    );
  }
}

export class InvalidReviewModerationException extends DomainException {
  constructor(action: string, status: string) {
    super(
      `Cannot apply '${action}' to a review in '${status}' status.`,
      'INVALID_REVIEW_MODERATION',
      'conflict',
    );
  }
}

export class InvalidReviewDateRangeException extends DomainException {
  constructor() {
    super(
      'createdFrom must be before or equal to createdTo.',
      'INVALID_REVIEW_DATE_RANGE',
      'validation',
    );
  }
}

export class ReviewHotelFilterRequiredException extends DomainException {
  constructor() {
    super(
      'A hotelId filter is required for hotel owners.',
      'REVIEW_HOTEL_FILTER_REQUIRED',
      'validation',
    );
  }
}
