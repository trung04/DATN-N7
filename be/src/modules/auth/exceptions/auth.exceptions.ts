import { DomainException } from '../../../common/exceptions/domain.exception';

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super(
      'Username or password is incorrect.',
      'INVALID_CREDENTIALS',
      'unauthorized',
    );
  }
}

export class InvalidSessionException extends DomainException {
  constructor() {
    super(
      'The authentication session is invalid or expired.',
      'INVALID_SESSION',
      'unauthorized',
    );
  }
}
