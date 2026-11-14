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

export class InvalidGoogleStateException extends DomainException {
  constructor() {
    super(
      'The Google authentication request is invalid or expired.',
      'INVALID_GOOGLE_STATE',
      'unauthorized',
    );
  }
}

export class GoogleAuthenticationFailedException extends DomainException {
  constructor() {
    super(
      'Google authentication could not be completed.',
      'GOOGLE_AUTHENTICATION_FAILED',
      'bad_gateway',
    );
  }
}

export class GoogleAuthenticationUnavailableException extends DomainException {
  constructor() {
    super(
      'Google authentication is not configured.',
      'GOOGLE_AUTHENTICATION_UNAVAILABLE',
      'service_unavailable',
    );
  }
}

export class GoogleAccountLinkRequiredException extends DomainException {
  constructor() {
    super(
      'An account already exists for this email address.',
      'GOOGLE_ACCOUNT_LINK_REQUIRED',
      'conflict',
    );
  }
}

export class AccountUnavailableException extends DomainException {
  constructor() {
    super(
      'The account is not available for login.',
      'ACCOUNT_UNAVAILABLE',
      'unauthorized',
    );
  }
}

export class AuthChallengeInvalidException extends DomainException {
  constructor() {
    super('The verification code is invalid, expired, or has been used.', 'AUTH_OTP_INVALID', 'validation');
  }
}

export class AuthChallengeRateLimitException extends DomainException {
  constructor() {
    super('Please wait before requesting another verification code.', 'AUTH_OTP_RATE_LIMITED', 'rate_limited');
  }
}

export class AuthEmailUnavailableException extends DomainException {
  constructor() {
    super('Email delivery is not configured. Contact the administrator.', 'AUTH_EMAIL_UNAVAILABLE', 'service_unavailable');
  }
}

export class AuthEmailDeliveryException extends DomainException {
  constructor() {
    super('The verification email could not be delivered. Please try again later.', 'AUTH_EMAIL_DELIVERY_FAILED', 'service_unavailable');
  }
}
