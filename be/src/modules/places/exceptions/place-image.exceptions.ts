import { DomainException } from '../../../common/exceptions/domain.exception';

export class InvalidPlaceImageException extends DomainException {
  constructor() {
    super(
      'Provide a valid, single-frame JPEG, PNG or WebP image of at most 5 MiB and 20 megapixels.',
      'PLACE_IMAGE_INVALID',
      'validation',
    );
  }
}

export class PlaceImageNotFoundException extends DomainException {
  constructor() {
    super('Place image was not found.', 'PLACE_IMAGE_NOT_FOUND', 'not_found');
  }
}

export class PlaceImageStorageException extends DomainException {
  constructor() {
    super(
      'Image storage is temporarily unavailable.',
      'PLACE_IMAGE_STORAGE_UNAVAILABLE',
      'service_unavailable',
    );
  }
}
