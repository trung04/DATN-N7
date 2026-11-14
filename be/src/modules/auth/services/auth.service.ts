import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  GoogleAccountConflictException,
  UserEmailConflictException,
} from '../../users/exceptions/user.exceptions';
import { UserEntity, UserStatus } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import { LoginRequest } from '../dtos/requests/login.request';
import { RegisterRequest } from '../dtos/requests/register.request';
import { EmailOtpRequest } from '../dtos/requests/email-otp.request';
import { RequestPasswordResetRequest, ResetPasswordRequest } from '../dtos/requests/request-password-reset.request';
import {
  AccountUnavailableException,
  GoogleAccountLinkRequiredException,
  InvalidCredentialsException,
  InvalidGoogleStateException,
  InvalidSessionException,
  AuthChallengeInvalidException,
  AuthChallengeRateLimitException,
  AuthEmailDeliveryException,
  AuthEmailUnavailableException,
} from '../exceptions/auth.exceptions';
import {
  AUTH_SESSION_STORE,
  SessionTokens,
} from '../interfaces/auth-session-store.interface';
import type { AuthSessionStore } from '../interfaces/auth-session-store.interface';
import { GOOGLE_IDENTITY_PROVIDER } from '../interfaces/google-identity-provider.interface';
import type {
  GoogleIdentity,
  GoogleIdentityProvider,
} from '../interfaces/google-identity-provider.interface';
import { GOOGLE_OAUTH_STATE_STORE } from '../interfaces/google-oauth-state-store.interface';
import type { GoogleOAuthStateStore } from '../interfaces/google-oauth-state-store.interface';
import { AUTH_CHALLENGE_STORE } from '../interfaces/auth-challenge-store.interface';
import type { AuthChallengePurpose, AuthChallengeStore } from '../interfaces/auth-challenge-store.interface';
import { EMAIL_SENDER } from '../interfaces/email-sender.interface';
import type { EmailSender } from '../interfaces/email-sender.interface';

const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;
const AUTH_OTP_TTL_MS = 10 * 60 * 1000;
const AUTH_OTP_COOLDOWN_MS = 60 * 1000;

export interface AuthenticatedSession extends SessionTokens {
  user: UserEntity;
}

export interface GoogleLoginSession extends AuthenticatedSession {
  returnTo: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    @Inject(AUTH_SESSION_STORE)
    private readonly sessions: AuthSessionStore,
    @Inject(GOOGLE_OAUTH_STATE_STORE)
    private readonly googleStates: GoogleOAuthStateStore,
    @Inject(GOOGLE_IDENTITY_PROVIDER)
    private readonly google: GoogleIdentityProvider,
    @Inject(AUTH_CHALLENGE_STORE)
    private readonly challenges: AuthChallengeStore,
    @Inject(EMAIL_SENDER)
    private readonly emailSender: EmailSender,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterRequest): Promise<void> {
    this.assertEmailConfigured();
    const email = input.email.trim().toLowerCase();
    await this.usersService.create({
      username: input.username,
      email,
      displayName: input.displayName,
      password: input.password,
      status: UserStatus.INACTIVE,
    });
    await this.issueOtp(email, 'EMAIL_VERIFICATION');
  }

  async verifyEmail(input: EmailOtpRequest): Promise<void> {
    const email = input.email.trim().toLowerCase();
    await this.consumeOtp(email, 'EMAIL_VERIFICATION', input.otp);
    const user = await this.usersService.findByEmail(email);
    if (!user || user.status !== UserStatus.INACTIVE) throw new AuthChallengeInvalidException();
    await this.usersService.verifyEmail(user.id);
  }

  async resendVerification(input: RequestPasswordResetRequest): Promise<void> {
    this.assertEmailConfigured();
    const email = input.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (!user || user.isEmailVerified || user.status !== UserStatus.INACTIVE) return;
    try {
      await this.issueOtp(email, 'EMAIL_VERIFICATION');
    } catch (error) {
      if (error instanceof AuthChallengeRateLimitException || error instanceof AuthEmailDeliveryException) return;
      throw error;
    }
  }

  async requestPasswordReset(input: RequestPasswordResetRequest): Promise<void> {
    this.assertEmailConfigured();
    const email = input.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isEmailVerified || user.status !== UserStatus.ACTIVE || !user.passwordHash) return;
    try {
      await this.issueOtp(email, 'PASSWORD_RESET');
    } catch (error) {
      if (error instanceof AuthChallengeRateLimitException || error instanceof AuthEmailDeliveryException) return;
      throw error;
    }
  }

  async resetPassword(input: ResetPasswordRequest): Promise<void> {
    const email = input.email.trim().toLowerCase();
    await this.consumeOtp(email, 'PASSWORD_RESET', input.otp);
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isEmailVerified || user.status !== UserStatus.ACTIVE || !user.passwordHash) {
      throw new AuthChallengeInvalidException();
    }
    await this.usersService.resetPassword(user.id, { newPassword: input.password });
  }

  private async issueOtp(email: string, purpose: AuthChallengePurpose): Promise<void> {
    this.assertEmailConfigured();
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = this.hashOtp(email, purpose, otp);
    if (!(await this.challenges.issue(email, purpose, codeHash, AUTH_OTP_TTL_MS, AUTH_OTP_COOLDOWN_MS))) {
      throw new AuthChallengeRateLimitException();
    }
    try {
      await this.emailSender.sendOtp(email, purpose, otp);
    } catch {
      await this.challenges.clear(email, purpose);
      throw new AuthEmailDeliveryException();
    }
  }

  private async consumeOtp(email: string, purpose: AuthChallengePurpose, otp: string): Promise<void> {
    const result = await this.challenges.consume(email, purpose, this.hashOtp(email, purpose, otp));
    if (result !== 'valid') throw new AuthChallengeInvalidException();
  }

  private hashOtp(email: string, purpose: AuthChallengePurpose, otp: string): string {
    const pepper = this.config.getOrThrow<string>('AUTH_OTP_PEPPER');
    return createHmac('sha256', pepper).update(`${purpose}:${email}:${otp}`).digest('hex');
  }

  private assertEmailConfigured(): void {
    if (!this.emailSender.isConfigured()) throw new AuthEmailUnavailableException();
  }

  async login(input: LoginRequest): Promise<AuthenticatedSession> {
    const user = await this.usersService.validateCredentials(
      input.username,
      input.password,
    );
    if (!user) throw new InvalidCredentialsException();
    return { user, ...(await this.sessions.create(user.id)) };
  }

  async beginGoogleLogin(returnTo?: string): Promise<string> {
    const state = this.randomToken();
    const nonce = this.randomToken();
    const authorization = await this.google.createAuthorizationRequest(
      state,
      nonce,
    );
    await this.googleStates.save(
      state,
      {
        codeVerifier: authorization.codeVerifier,
        nonce,
        returnTo: this.safeReturnTo(returnTo),
      },
      GOOGLE_STATE_TTL_MS,
    );
    return authorization.url;
  }

  async completeGoogleLogin(
    code: string,
    state: string,
  ): Promise<GoogleLoginSession> {
    const context = await this.googleStates.consume(state);
    if (!context) throw new InvalidGoogleStateException();
    const identity = await this.google.exchangeCode(
      code,
      context.codeVerifier,
      context.nonce,
    );
    const user = await this.resolveGoogleUser(identity);
    return {
      user,
      returnTo: context.returnTo,
      ...(await this.sessions.create(user.id)),
    };
  }

  async authenticate(accessToken: string): Promise<UserEntity> {
    const session = await this.sessions.validateAccess(accessToken);
    if (!session) throw new InvalidSessionException();
    const user = await this.usersService.findActiveById(session.userId);
    if (!user) {
      await this.sessions.revokeFamily(session.familyId);
      throw new InvalidSessionException();
    }
    return user;
  }

  async refresh(refreshToken: string): Promise<AuthenticatedSession> {
    const result = await this.sessions.rotate(refreshToken);
    if (result.status !== 'rotated') throw new InvalidSessionException();
    const user = await this.usersService.findActiveById(result.userId);
    if (!user) {
      await this.sessions.revokeFamily(result.familyId);
      throw new InvalidSessionException();
    }
    return {
      user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessExpiresInMs: result.accessExpiresInMs,
      refreshExpiresInMs: result.refreshExpiresInMs,
    };
  }

  logout(accessToken?: string, refreshToken?: string): Promise<void> {
    return this.sessions.revokeByTokens(accessToken, refreshToken);
  }

  private async resolveGoogleUser(
    identity: GoogleIdentity,
  ): Promise<UserEntity> {
    const linked = await this.usersService.findByGoogleAccountId(
      identity.subject,
    );
    if (linked) return this.requireActive(linked);
    if (await this.usersService.findByEmail(identity.email)) {
      throw new GoogleAccountLinkRequiredException();
    }
    try {
      return await this.usersService.createGoogleUser(identity);
    } catch (error) {
      if (error instanceof UserEmailConflictException) {
        throw new GoogleAccountLinkRequiredException();
      }
      if (error instanceof GoogleAccountConflictException) {
        const concurrent = await this.usersService.findByGoogleAccountId(
          identity.subject,
        );
        if (concurrent) return this.requireActive(concurrent);
      }
      throw error;
    }
  }

  private requireActive(user: UserEntity): UserEntity {
    if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
      throw new AccountUnavailableException();
    }
    return user;
  }

  private safeReturnTo(value?: string): string {
    return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
  }

  private randomToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
