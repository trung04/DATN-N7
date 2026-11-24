import { DomainException } from '../../../common/exceptions/domain.exception';
export class InvalidRoomImageException extends DomainException {
  constructor() {
    super(
      'Provide a valid JPEG, PNG or WebP image of at most 5 MiB.',
      'ROOM_IMAGE_INVALID',
      'validation',
    );
  }
}
export class RoomImageNotFoundException extends DomainException {
  constructor() {
    super('Room image not found.', 'ROOM_IMAGE_NOT_FOUND', 'not_found');
  }
}
export class RoomImageStorageException extends DomainException {
  constructor() {
    super(
      'Room image storage is unavailable.',
      'ROOM_IMAGE_STORAGE_UNAVAILABLE',
      'service_unavailable',
    );
  }
}
