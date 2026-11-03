import { DomainException } from '../../../common/exceptions/domain.exception';

export class UserNotFoundException extends DomainException {
  constructor(id: string) {
    super(`User '${id}' was not found.`, 'USER_NOT_FOUND', 'not_found');
  }
}

export class UsernameConflictException extends DomainException {
  constructor(username: string) {
    super(
      `Username '${username}' already exists.`,
      'USERNAME_CONFLICT',
      'conflict',
    );
  }
}

export class UserEmailConflictException extends DomainException {
  constructor(email: string) {
    super(
      `Email '${email}' already exists.`,
      'USER_EMAIL_CONFLICT',
      'conflict',
    );
  }
}

export class GoogleAccountConflictException extends DomainException {
  constructor() {
    super(
      'Google account is already linked to another user.',
      'GOOGLE_ACCOUNT_CONFLICT',
      'conflict',
    );
  }
}

export class EmptyUserUpdateException extends DomainException {
  constructor() {
    super(
      'At least one user field must be provided.',
      'USER_UPDATE_EMPTY',
      'validation',
    );
  }
}

export class InvalidDateOfBirthException extends DomainException {
  constructor() {
    super(
      'Date of birth cannot be in the future.',
      'INVALID_DATE_OF_BIRTH',
      'validation',
    );
  }
}

export class PasswordTooLongException extends DomainException {
  constructor() {
    super(
      'Password exceeds the bcrypt 72-byte limit.',
      'PASSWORD_TOO_LONG',
      'validation',
    );
  }
}
