import { ConfigService } from '@nestjs/config';
import {
  UserEntity,
  UserRole,
  UserStatus,
} from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import {
  AccountUnavailableException,
  AuthChallengeInvalidException,
  AuthEmailDeliveryException,
  AuthRegistrationSessionUnavailableException,
  GoogleAccountLinkRequiredException,
  InvalidCredentialsException,
  InvalidGoogleStateException,
} from '../exceptions/auth.exceptions';
import type { AuthSessionStore } from '../interfaces/auth-session-store.interface';
import type {
  GoogleIdentity,
  GoogleIdentityProvider,
} from '../interfaces/google-identity-provider.interface';
import type { GoogleOAuthStateStore } from '../interfaces/google-oauth-state-store.interface';
import type { AuthChallengeStore } from '../interfaces/auth-challenge-store.interface';
import type { EmailSender } from '../interfaces/email-sender.interface';
import type { TwoFactorLoginChallengeStore } from '../interfaces/two-factor-login-challenge-store.interface';
import { TwoFactorService } from './two-factor.service';
import { AuthService } from './auth.service';

const user = (overrides: Partial<UserEntity> = {}): UserEntity =>
  Object.assign(new UserEntity(), {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'traveler',
    email: 'traveler@example.com',
    passwordHash: '$2b$12$hashed',
    googleAccountId: null,
    status: UserStatus.ACTIVE,
    role: UserRole.TOURIST,
    deletedAt: null,
    isTwoFactorEnabled: false,
    ...overrides,
  });

const identity: GoogleIdentity = {
  subject: 'google-subject',
  email: 'traveler@example.com',
  displayName: 'Traveler',
  firstName: 'Travel',
  lastName: 'Er',
};

const tokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessExpiresInMs: 60000,
  refreshExpiresInMs: 120000,
};

describe('AuthService', () => {
  let users: {
    create: jest.Mock;
    validateCredentials: jest.Mock;
    findActiveById: jest.Mock;
    findByGoogleAccountId: jest.Mock;
    findByEmail: jest.Mock;
    createGoogleUser: jest.Mock;
    verifyEmail: jest.Mock;
  };
  let sessions: jest.Mocked<AuthSessionStore>;
  let states: jest.Mocked<GoogleOAuthStateStore>;
  let google: jest.Mocked<GoogleIdentityProvider>;
  let challenges: jest.Mocked<AuthChallengeStore>;
  let email: jest.Mocked<EmailSender>;
  let twoFactorChallenges: jest.Mocked<TwoFactorLoginChallengeStore>;
  let twoFactor: { verifyCode: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    users = {
      create: jest.fn(),
      validateCredentials: jest.fn(),
      findActiveById: jest.fn(),
      findByGoogleAccountId: jest.fn(),
      findByEmail: jest.fn(),
      createGoogleUser: jest.fn(),
      verifyEmail: jest.fn(),
    };
    sessions = {
      create: jest.fn(),
      validateAccess: jest.fn(),
      rotate: jest.fn(),
      revokeByTokens: jest.fn(),
      revokeFamily: jest.fn(),
    };
    states = { save: jest.fn(), consume: jest.fn() };
    google = {
      createAuthorizationRequest: jest.fn(),
      exchangeCode: jest.fn(),
    };
    challenges = { issue: jest.fn().mockResolvedValue(true), consume: jest.fn(), clear: jest.fn() };
    email = { isConfigured: jest.fn().mockReturnValue(true), sendOtp: jest.fn() };
    twoFactorChallenges = { create: jest.fn(), takeAttempt: jest.fn() };
    twoFactor = { verifyCode: jest.fn() };
    service = new AuthService(
      users as unknown as UsersService,
      sessions,
      states,
      google,
      challenges,
      email,
      new ConfigService({ AUTH_OTP_PEPPER: 'test-otp-pepper-with-sufficient-length' }),
      twoFactorChallenges,
      twoFactor as unknown as TwoFactorService,
    );
  });

  it('verifies an owner only using the OTP issued for that pending account', async () => {
    const pending = user({ status: UserStatus.INACTIVE, role: UserRole.HOTEL_OWNER, isEmailVerified: false });
    users.create.mockResolvedValue(pending);
    users.findByEmail.mockResolvedValue(pending);
    users.verifyEmail.mockResolvedValue(user({ role: UserRole.HOTEL_OWNER, isEmailVerified: true }));

    await service.registerHotelOwner({
      username: pending.username, displayName: 'Hotel Owner', email: pending.email, password: 'Password123',
    });
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ status: UserStatus.INACTIVE }), UserRole.HOTEL_OWNER);
    expect(users.verifyEmail).not.toHaveBeenCalled();
    const otp = email.sendOtp.mock.calls[0][2];
    const issued = challenges.issue.mock.calls[0][2];
    challenges.consume.mockImplementation(async (_email, _purpose, hash) => hash === issued ? 'valid' : 'invalid');

    users.findByEmail.mockResolvedValueOnce({ ...pending, id: '22222222-2222-4222-8222-222222222222' });
    await expect(service.verifyEmail({ email: pending.email, otp })).rejects.toBeInstanceOf(AuthChallengeInvalidException);
    expect(users.verifyEmail).not.toHaveBeenCalled();
    await expect(service.verifyEmail({ email: pending.email, otp })).resolves.toBeUndefined();
    expect(users.verifyEmail).toHaveBeenCalledWith(pending.id, pending.email, UserRole.HOTEL_OWNER);
  });

  it('keeps an owner account pending for resend after a delivery failure', async () => {
    const pending = user({ status: UserStatus.INACTIVE, role: UserRole.HOTEL_OWNER, isEmailVerified: false });
    users.create.mockResolvedValue(pending);
    users.findByEmail.mockResolvedValue(pending);
    email.sendOtp.mockRejectedValueOnce(new Error('Mail unavailable'));

    await expect(service.registerHotelOwner({
      username: pending.username, email: pending.email, password: 'Password123',
    })).rejects.toBeInstanceOf(AuthEmailDeliveryException);
    expect(challenges.clear).toHaveBeenCalledWith(pending.email, 'EMAIL_VERIFICATION');
    await service.resendVerification({ email: pending.email });
    expect(email.sendOtp).toHaveBeenCalledTimes(2);
    expect(users.verifyEmail).not.toHaveBeenCalled();
  });

  it.each([UserRole.TOURIST, UserRole.HOTEL_OWNER])('starts a session for the newly verified %s', async role => {
    const pending = user({ status: UserStatus.INACTIVE, role, isEmailVerified: false });
    const active = user({ role, isEmailVerified: true });
    users.findByEmail.mockResolvedValue(pending);
    users.verifyEmail.mockResolvedValue(active);
    challenges.consume.mockResolvedValueOnce('invalid').mockResolvedValueOnce('valid');
    sessions.create.mockResolvedValue(tokens);

    await expect(service.verifyEmailAndCreateSession({ email: pending.email, otp: '123456' })).rejects.toBeInstanceOf(AuthChallengeInvalidException);
    expect(sessions.create).not.toHaveBeenCalled();
    expect(users.verifyEmail).not.toHaveBeenCalled();

    await expect(service.verifyEmailAndCreateSession({ email: pending.email, otp: '654321' })).resolves.toEqual({ user: active, ...tokens });
    expect(sessions.create).toHaveBeenCalledWith(pending.id);
    expect(users.verifyEmail).toHaveBeenCalledWith(pending.id, pending.email, role);

    users.findByEmail.mockResolvedValue(active);
    await expect(service.verifyEmailAndCreateSession({ email: pending.email, otp: '654321' })).rejects.toBeInstanceOf(AuthChallengeInvalidException);
    expect(sessions.create).toHaveBeenCalledTimes(1);
  });

  it('keeps the account pending when the registration session store is unavailable', async () => {
    const pending = user({ status: UserStatus.INACTIVE });
    users.findByEmail.mockResolvedValue(pending);
    challenges.consume.mockResolvedValue('valid');
    sessions.create.mockRejectedValue(new Error('Session store unavailable'));

    await expect(service.verifyEmailAndCreateSession({ email: pending.email, otp: '123456' })).rejects.toBeInstanceOf(AuthRegistrationSessionUnavailableException);
    expect(users.verifyEmail).not.toHaveBeenCalled();
  });

  it('revokes the provisional session when account activation cannot commit', async () => {
    const pending = user({ status: UserStatus.INACTIVE });
    users.findByEmail.mockResolvedValue(pending);
    challenges.consume.mockResolvedValue('valid');
    sessions.create.mockResolvedValue(tokens);
    sessions.revokeByTokens.mockResolvedValue(undefined);
    users.verifyEmail.mockResolvedValue(null);

    await expect(service.verifyEmailAndCreateSession({ email: pending.email, otp: '123456' })).rejects.toBeInstanceOf(AuthChallengeInvalidException);
    expect(sessions.revokeByTokens).toHaveBeenCalledWith(tokens.accessToken, tokens.refreshToken);
  });

  it('creates a rotating session after valid password credentials', async () => {
    const existing = user();
    users.validateCredentials.mockResolvedValue(existing);
    sessions.create.mockResolvedValue(tokens);

    await expect(
      service.login({ username: 'traveler', password: 'Password123' }),
    ).resolves.toEqual({ user: existing, ...tokens });

    users.validateCredentials.mockResolvedValue(null);
    await expect(
      service.login({ username: 'traveler', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
  });

  it('returns a short-lived challenge instead of a session when password login requires 2FA', async () => {
    const existing = user({ isTwoFactorEnabled: true });
    users.validateCredentials.mockResolvedValue(existing);
    twoFactorChallenges.create.mockResolvedValue('two-factor-challenge');

    await expect(
      service.login({ username: 'traveler', password: 'Password123' }),
    ).resolves.toEqual({
      requiresTwoFactor: true,
      challengeToken: 'two-factor-challenge',
      returnTo: '/',
    });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('exchanges a valid 2FA challenge and code for the full session', async () => {
    const existing = user({ isTwoFactorEnabled: true });
    twoFactorChallenges.takeAttempt.mockResolvedValue({
      userId: existing.id,
      returnTo: '/trips',
    });
    users.findActiveById.mockResolvedValue(existing);
    sessions.create.mockResolvedValue(tokens);

    await expect(
      service.completeTwoFactorLogin('two-factor-challenge', '123456'),
    ).resolves.toEqual({ user: existing, returnTo: '/trips', ...tokens });
    expect(twoFactor.verifyCode).toHaveBeenCalledWith(existing.id, '123456');
  });

  it('stores one-time Google state with PKCE and a safe return path', async () => {
    google.createAuthorizationRequest.mockResolvedValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth',
      codeVerifier: 'code-verifier',
    });

    await expect(service.beginGoogleLogin('//attacker.example')).resolves.toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(states.save.mock.calls[0][1]).toMatchObject({
      codeVerifier: 'code-verifier',
      returnTo: '/',
    });
  });

  it('stores the authenticated user in state when linking Google', async () => {
    google.createAuthorizationRequest.mockResolvedValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth',
      codeVerifier: 'code-verifier',
    });

    await expect(
      (service as unknown as { beginGoogleLink(userId: string, returnTo?: string): Promise<string> })
        .beginGoogleLink(user().id, '/profile'),
    ).resolves.toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(states.save.mock.calls[0][1]).toMatchObject({
      linkUserId: user().id,
      returnTo: '/profile',
    });
  });

  it('rejects an expired or replayed Google state', async () => {
    states.consume.mockResolvedValue(null);

    await expect(
      service.completeGoogleLogin('code', 'expired-state'),
    ).rejects.toBeInstanceOf(InvalidGoogleStateException);
    expect(google.exchangeCode.mock.calls).toHaveLength(0);
  });

  it('logs in an existing linked Google user', async () => {
    const existing = user({ googleAccountId: identity.subject });
    states.consume.mockResolvedValue({
      codeVerifier: 'verifier',
      nonce: 'nonce',
      returnTo: '/trips',
    });
    google.exchangeCode.mockResolvedValue(identity);
    users.findByGoogleAccountId.mockResolvedValue(existing);
    sessions.create.mockResolvedValue(tokens);

    await expect(service.completeGoogleLogin('code', 'state')).resolves.toEqual(
      { user: existing, returnTo: '/trips', ...tokens },
    );
    expect(users.createGoogleUser.mock.calls).toHaveLength(0);
  });

  it('defers the Google session until 2FA succeeds for an enabled account', async () => {
    const existing = user({
      googleAccountId: identity.subject,
      isTwoFactorEnabled: true,
    });
    states.consume.mockResolvedValue({
      codeVerifier: 'verifier',
      nonce: 'nonce',
      returnTo: '/trips',
    });
    google.exchangeCode.mockResolvedValue(identity);
    users.findByGoogleAccountId.mockResolvedValue(existing);
    twoFactorChallenges.create.mockResolvedValue('google-two-factor-challenge');

    await expect(service.completeGoogleLogin('code', 'state')).resolves.toEqual({
      requiresTwoFactor: true,
      challengeToken: 'google-two-factor-challenge',
      returnTo: '/trips',
    });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('creates a Google-only user when the identity is new', async () => {
    const created = user({
      passwordHash: null,
      googleAccountId: identity.subject,
      isEmailVerified: true,
    });
    states.consume.mockResolvedValue({
      codeVerifier: 'verifier',
      nonce: 'nonce',
      returnTo: '/',
    });
    google.exchangeCode.mockResolvedValue(identity);
    users.findByGoogleAccountId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    users.createGoogleUser.mockResolvedValue(created);
    sessions.create.mockResolvedValue(tokens);

    await service.completeGoogleLogin('code', 'state');

    expect(users.createGoogleUser.mock.calls).toContainEqual([identity]);
    expect(sessions.create.mock.calls).toContainEqual([created.id]);
  });

  it('does not silently merge an existing email account', async () => {
    states.consume.mockResolvedValue({
      codeVerifier: 'verifier',
      nonce: 'nonce',
      returnTo: '/',
    });
    google.exchangeCode.mockResolvedValue(identity);
    users.findByGoogleAccountId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(user());

    await expect(
      service.completeGoogleLogin('code', 'state'),
    ).rejects.toBeInstanceOf(GoogleAccountLinkRequiredException);
    expect(sessions.create.mock.calls).toHaveLength(0);
  });

  it('rejects a linked account that is no longer active', async () => {
    states.consume.mockResolvedValue({
      codeVerifier: 'verifier',
      nonce: 'nonce',
      returnTo: '/',
    });
    google.exchangeCode.mockResolvedValue(identity);
    users.findByGoogleAccountId.mockResolvedValue(
      user({ status: UserStatus.SUSPENDED, googleAccountId: identity.subject }),
    );

    await expect(
      service.completeGoogleLogin('code', 'state'),
    ).rejects.toBeInstanceOf(AccountUnavailableException);
  });
});
