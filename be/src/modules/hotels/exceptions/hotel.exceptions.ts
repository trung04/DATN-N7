import { DomainException } from '../../../common/exceptions/domain.exception';

export class HotelNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Hotel '${id}' was not found.`, 'HOTEL_NOT_FOUND', 'not_found');
  }
}

export class HotelTaxCodeConflictException extends DomainException {
  constructor() {
    super(
      'Tax code is already assigned to another hotel.',
      'HOTEL_TAX_CODE_CONFLICT',
      'conflict',
    );
  }
}

export class EmptyHotelUpdateException extends DomainException {
  constructor() {
    super(
      'At least one hotel field must be provided.',
      'HOTEL_UPDATE_EMPTY',
      'validation',
    );
  }
}

export class HotelUpdateLockedException extends DomainException {
  constructor() {
    super(
      'Hotel information cannot be changed while approval is pending.',
      'HOTEL_UPDATE_LOCKED',
      'conflict',
    );
  }
}

export class HotelLegalInformationLockedException extends DomainException {
  constructor() {
    super(
      'Approved legal information cannot be changed in the current workflow.',
      'HOTEL_LEGAL_INFORMATION_LOCKED',
      'conflict',
    );
  }
}

export class HotelDocumentNotFoundException extends DomainException {
  constructor(id: string) {
    super(
      `Hotel document '${id}' was not found.`,
      'HOTEL_DOCUMENT_NOT_FOUND',
      'not_found',
    );
  }
}

export class HotelDocumentLockedException extends DomainException {
  constructor() {
    super(
      'Hotel documents can only be changed while the hotel is draft or rejected.',
      'HOTEL_DOCUMENT_LOCKED',
      'conflict',
    );
  }
}

export class HotelSubmissionInvalidException extends DomainException {
  constructor(detail: string) {
    super(detail, 'HOTEL_SUBMISSION_INVALID', 'validation');
  }
}

export class InvalidHotelStatusTransitionException extends DomainException {
  constructor(from: string, action: string) {
    super(
      `Hotel action '${action}' is not allowed from status '${from}'.`,
      'INVALID_HOTEL_STATUS_TRANSITION',
      'conflict',
    );
  }
}

export class HotelNotActiveException extends DomainException {
  constructor(id: string) {
    super(`Hotel '${id}' is not active.`, 'HOTEL_NOT_ACTIVE', 'conflict');
  }
}

export class HotelReferenceException extends DomainException {
  constructor(resource: 'owner' | 'place' | 'reviewer') {
    super(
      `Referenced hotel ${resource} does not exist.`,
      'HOTEL_REFERENCE_NOT_FOUND',
      'not_found',
    );
  }
}
