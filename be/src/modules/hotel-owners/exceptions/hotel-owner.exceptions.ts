import { DomainException } from '../../../common/exceptions/domain.exception';

export class HotelOwnerNotFoundException extends DomainException {
  constructor(userId: string) {
    super(
      `Hotel owner for user '${userId}' was not found.`,
      'HOTEL_OWNER_NOT_FOUND',
      'not_found',
    );
  }
}

export class HotelOwnerConflictException extends DomainException {
  constructor(userId: string) {
    super(
      `User '${userId}' is already registered as a hotel owner.`,
      'HOTEL_OWNER_CONFLICT',
      'conflict',
    );
  }
}

export class EmptyHotelOwnerUpdateException extends DomainException {
  constructor() {
    super(
      'At least one hotel owner field must be provided.',
      'HOTEL_OWNER_UPDATE_EMPTY',
      'validation',
    );
  }
}

export class HotelOwnerUserReferenceException extends DomainException {
  constructor(userId: string) {
    super(`User '${userId}' was not found.`, 'USER_NOT_FOUND', 'not_found');
  }
}
