import { DomainException } from '../../../common/exceptions/domain.exception';

export class RoomNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Room '${id}' was not found.`, 'ROOM_NOT_FOUND', 'not_found');
  }
}

export class RoomNumberConflictException extends DomainException {
  constructor(hotelId: string, roomNumber: string) {
    super(
      `Room number '${roomNumber}' already exists for hotel '${hotelId}'.`,
      'ROOM_NUMBER_CONFLICT',
      'conflict',
    );
  }
}

export class EmptyRoomUpdateException extends DomainException {
  constructor() {
    super(
      'At least one room field must be provided.',
      'ROOM_UPDATE_EMPTY',
      'validation',
    );
  }
}
