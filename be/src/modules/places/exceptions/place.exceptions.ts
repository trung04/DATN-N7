import { DomainException } from '../../../common/exceptions/domain.exception';

export class PlaceNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Place '${id}' was not found.`, 'PLACE_NOT_FOUND', 'not_found');
  }
}

export class ExternalProviderConflictException extends DomainException {
  constructor() {
    super(
      'External provider identifier is already assigned to another place.',
      'PLACE_EXTERNAL_PROVIDER_CONFLICT',
      'conflict',
    );
  }
}

export class EmptyPlaceUpdateException extends DomainException {
  constructor() {
    super(
      'At least one place field must be provided.',
      'PLACE_UPDATE_EMPTY',
      'validation',
    );
  }
}

export class CoordinatePairRequiredException extends DomainException {
  constructor() {
    super(
      'Latitude and longitude are required.',
      'PLACE_COORDINATE_PAIR_REQUIRED',
      'validation',
    );
  }
}
