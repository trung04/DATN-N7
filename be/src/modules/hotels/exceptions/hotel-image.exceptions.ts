import { DomainException } from '../../../common/exceptions/domain.exception';

export class InvalidHotelImageException extends DomainException {
  constructor() {
    super(
      'Provide a valid, single-frame JPEG, PNG or WebP image of at most 5 MiB and 20 megapixels.',
      'HOTEL_IMAGE_INVALID',
      'validation',
    );
  }
}
export class HotelImageNotFoundException extends DomainException {
  constructor() {
    super('Hotel image was not found.', 'HOTEL_IMAGE_NOT_FOUND', 'not_found');
  }
}
export class HotelImageStorageException extends DomainException {
  constructor() {
    super(
      'Image storage is temporarily unavailable.',
      'HOTEL_IMAGE_STORAGE_UNAVAILABLE',
      'service_unavailable',
    );
  }
}
