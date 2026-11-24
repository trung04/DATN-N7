import { DomainException } from '../../../common/exceptions/domain.exception';

export class AuthorizationDeniedException extends DomainException {
  constructor() {
    super(
      'You are not allowed to perform this action.',
      'AUTHORIZATION_DENIED',
      'forbidden',
    );
  }
}
