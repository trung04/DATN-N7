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

export class InvalidPlaceCatalogValueException extends DomainException {
  constructor(kind: 'category' | 'topic', values: string[]) {
    super(
      `Unknown place ${kind} value(s): ${values.join(', ')}.`,
      'PLACE_CATALOG_VALUE_INVALID',
      'validation',
    );
  }
}

export class InvalidPlacePriceException extends DomainException {
  constructor() {
    super(
      'Maximum reference price must be greater than or equal to minimum price.',
      'PLACE_REFERENCE_PRICE_INVALID',
      'validation',
    );
  }
}
