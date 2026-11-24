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

export class CancellationPolicyActiveConflictException extends DomainException {
  constructor(hotelId: string) {
    super(
      `Hotel '${hotelId}' already has an active cancellation policy.`,
      'CANCELLATION_POLICY_ACTIVE_CONFLICT',
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

export class CancellationPolicyFeeRequiredException extends DomainException {
  constructor() {
    super(
      'A cancellation fee rate is required when cancellation is allowed.',
      'CANCELLATION_POLICY_FEE_REQUIRED',
      'validation',
    );
  }
}

export class CancellationPolicyDescriptionRequiredException extends DomainException {
  constructor() {
    super(
      'A clear explanation is required when cancellation is not allowed.',
      'CANCELLATION_POLICY_DESCRIPTION_REQUIRED',
      'validation',
    );
  }
}

export class CancellationPolicyRequiredException extends DomainException {
  constructor(issue: string) {
    super(issue, 'CANCELLATION_POLICY_REQUIRED', 'conflict');
  }
}

export class CancellationPolicyChangedException extends DomainException {
  constructor() {
    super(
      'The cancellation policy changed. Review the updated terms before booking.',
      'CANCELLATION_POLICY_CHANGED',
      'conflict',
    );
  }
}
