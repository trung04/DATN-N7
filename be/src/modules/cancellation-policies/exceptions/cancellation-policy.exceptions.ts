import { DomainException } from '../../../common/exceptions/domain.exception';

export class CancellationPolicyNotFoundException extends DomainException {
  constructor(id: string) {
    super(
      `Cancellation policy '${id}' was not found.`,
      'CANCELLATION_POLICY_NOT_FOUND',
      'not_found',
    );
  }
}

export class CancellationPolicyNameConflictException extends DomainException {
  constructor(hotelId: string, name: string) {
    super(
      `Cancellation policy '${name}' already exists for hotel '${hotelId}'.`,
      'CANCELLATION_POLICY_NAME_CONFLICT',
      'conflict',
    );
  }
}

export class EmptyCancellationPolicyUpdateException extends DomainException {
  constructor() {
    super(
      'At least one cancellation policy field must be provided.',
      'CANCELLATION_POLICY_UPDATE_EMPTY',
      'validation',
    );
  }
}

export class InvalidCancellationPolicyRangeException extends DomainException {
  constructor(message = 'Cancellation policy time range is invalid or overlaps another policy.') {
    super(message, 'INVALID_CANCELLATION_POLICY_RANGE', 'conflict');
  }
}
