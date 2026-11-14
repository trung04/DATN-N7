import { DomainException } from '../../../common/exceptions/domain.exception';

export class BookingNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Booking '${id}' was not found.`, 'BOOKING_NOT_FOUND', 'not_found');
  }
}

export class BookingCodeConflictException extends DomainException {
  constructor() {
    super(
      'Generated booking code already exists. Please retry the request.',
      'BOOKING_CODE_CONFLICT',
      'conflict',
    );
  }
}

export class IdempotencyKeyReusedException extends DomainException {
  constructor() {
    super(
      'Idempotency-Key was already used with a different request body.',
      'IDEMPOTENCY_KEY_REUSED',
      'conflict',
    );
  }
}

export class BookingTransactionConflictException extends DomainException {
  constructor() {
    super(
      'Transaction identifier is already assigned to another booking.',
      'BOOKING_TRANSACTION_CONFLICT',
      'conflict',
    );
  }
}

export class EmptyBookingUpdateException extends DomainException {
  constructor() {
    super(
      'At least one booking field must be provided.',
      'BOOKING_UPDATE_EMPTY',
      'validation',
    );
  }
}

export class BookingPolicyHotelMismatchException extends DomainException {
  constructor() {
    super(
      'Cancellation policy does not belong to the booking hotel.',
      'BOOKING_POLICY_HOTEL_MISMATCH',
      'validation',
    );
  }
}

export class InvalidBookingStayException extends DomainException {
  constructor() {
    super(
      'checkOutDate must be later than checkInDate.',
      'INVALID_BOOKING_STAY',
      'validation',
    );
  }
}

export class BookingRoomsHotelMismatchException extends DomainException {
  constructor() {
    super(
      'All rooms in a booking must belong to the same hotel.',
      'BOOKING_ROOMS_HOTEL_MISMATCH',
      'validation',
    );
  }
}

export class BookingRoomsCurrencyMismatchException extends DomainException {
  constructor() {
    super(
      'All rooms in a booking must use the same currency.',
      'BOOKING_ROOMS_CURRENCY_MISMATCH',
      'validation',
    );
  }
}

export class BookingRoomNotOperationalException extends DomainException {
  constructor(roomId: string) {
    super(
      `Room '${roomId}' is not available for booking.`,
      'BOOKING_ROOM_NOT_OPERATIONAL',
      'conflict',
    );
  }
}

export class BookingCapacityExceededException extends DomainException {
  constructor() {
    super(
      'The number of guests exceeds the total capacity of the selected rooms.',
      'BOOKING_CAPACITY_EXCEEDED',
      'validation',
    );
  }
}

export class BookingRoomUnavailableException extends DomainException {
  constructor(roomId: string) {
    super(
      `Room '${roomId}' is already booked for the selected dates.`,
      'BOOKING_ROOM_UNAVAILABLE',
      'conflict',
    );
  }
}

export class BookingReservationExpiredException extends DomainException {
  constructor() {
    super(
      'The room reservation hold has expired. Create a new booking.',
      'BOOKING_RESERVATION_EXPIRED',
      'conflict',
    );
  }
}

export class BookingRoomReferenceException extends DomainException {
  constructor() {
    super(
      'One or more selected rooms no longer exist.',
      'BOOKING_ROOM_NOT_FOUND',
      'not_found',
    );
  }
}

export class BookingCancellationPolicyReferenceException extends DomainException {
  constructor() {
    super(
      'Cancellation policy was not found.',
      'CANCELLATION_POLICY_NOT_FOUND',
      'not_found',
    );
  }
}

export class InvalidBookingDateRangeException extends DomainException {
  constructor() {
    super(
      'createdFrom must be earlier than or equal to createdTo.',
      'INVALID_BOOKING_DATE_RANGE',
      'validation',
    );
  }
}

export class InvalidBookingTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(
      `Booking status cannot transition from '${from}' to '${to}'.`,
      'INVALID_BOOKING_STATUS_TRANSITION',
      'conflict',
    );
  }
}

export class InvalidQrExpiryException extends DomainException {
  constructor() {
    super(
      'QR expiration must be later than the current time.',
      'INVALID_QR_EXPIRY',
      'validation',
    );
  }
}

export class BookingPaymentAlreadyInitializedException extends DomainException {
  constructor() {
    super(
      'A payment has already been initialized for this booking.',
      'BOOKING_PAYMENT_ALREADY_INITIALIZED',
      'conflict',
    );
  }
}

export class SePayCurrencyNotSupportedException extends DomainException {
  constructor() {
    super(
      'SePay Sandbox payments require VND currency.',
      'SEPAY_CURRENCY_NOT_SUPPORTED',
      'validation',
    );
  }
}

export class SePayAmountNotSupportedException extends DomainException {
  constructor() {
    super(
      'SePay Sandbox payments require a whole-number amount greater than zero VND.',
      'SEPAY_AMOUNT_NOT_SUPPORTED',
      'validation',
    );
  }
}

export class SePayNotConfiguredException extends DomainException {
  constructor() {
    super(
      'SePay Sandbox is not configured.',
      'SEPAY_NOT_CONFIGURED',
      'service_unavailable',
    );
  }
}

export class BookingRefundAlreadyInitializedException extends DomainException {
  constructor() {
    super(
      'A refund has already been initialized for this booking.',
      'BOOKING_REFUND_ALREADY_INITIALIZED',
      'conflict',
    );
  }
}

export class BookingAlreadyPaidException extends DomainException {
  constructor() {
    super('Booking is already paid.', 'BOOKING_ALREADY_PAID', 'conflict');
  }
}

export class BookingPaymentRequiredException extends DomainException {
  constructor(action: string) {
    super(
      `Booking must be paid before ${action}.`,
      'BOOKING_PAYMENT_REQUIRED',
      'conflict',
    );
  }
}

export class BookingAlreadySettledException extends DomainException {
  constructor() {
    super(
      'Booking settlement is already complete.',
      'BOOKING_ALREADY_SETTLED',
      'conflict',
    );
  }
}

export class BookingAlreadyRefundedException extends DomainException {
  constructor() {
    super(
      'Booking refund is already complete.',
      'BOOKING_ALREADY_REFUNDED',
      'conflict',
    );
  }
}

export class RefundAmountExceededException extends DomainException {
  constructor() {
    super(
      'Refund amount cannot exceed the amount paid by the customer.',
      'REFUND_AMOUNT_EXCEEDED',
      'validation',
    );
  }
}

export class BookingActionNotAllowedException extends DomainException {
  constructor(action: string) {
    super(
      `Booking does not allow the '${action}' action in its current state.`,
      'BOOKING_ACTION_NOT_ALLOWED',
      'conflict',
    );
  }
}

export class BookingCancellationNotAllowedException extends DomainException {
  constructor(reason: string) {
    super(reason, 'BOOKING_CANCELLATION_NOT_ALLOWED', 'conflict');
  }
}

export class SettlementBaseAmountExceededException extends DomainException {
  constructor() {
    super(
      'Settlement base amount cannot exceed the amount paid by the customer.',
      'SETTLEMENT_BASE_AMOUNT_EXCEEDED',
      'validation',
    );
  }
}

export class InvalidBookingFinancialTimestampException extends DomainException {
  constructor(field: string) {
    super(
      `${field} cannot be in the future.`,
      'INVALID_BOOKING_FINANCIAL_TIMESTAMP',
      'validation',
    );
  }
}
