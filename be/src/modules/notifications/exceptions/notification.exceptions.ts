import { DomainException } from '../../../common/exceptions/domain.exception';

export class NotificationNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Notification '${id}' was not found.`, 'NOTIFICATION_NOT_FOUND', 'not_found');
  }
}
