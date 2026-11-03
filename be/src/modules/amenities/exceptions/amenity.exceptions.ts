import { DomainException } from '../../../common/exceptions/domain.exception';

export class AmenityNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Amenity '${id}' was not found.`, 'AMENITY_NOT_FOUND', 'not_found');
  }
}

export class AmenityCodeConflictException extends DomainException {
  constructor(code: string) {
    super(
      `Amenity code '${code}' already exists.`,
      'AMENITY_CODE_CONFLICT',
      'conflict',
    );
  }
}

export class EmptyAmenityUpdateException extends DomainException {
  constructor() {
    super(
      'At least one of code or name must be provided.',
      'AMENITY_UPDATE_EMPTY',
      'validation',
    );
  }
}
