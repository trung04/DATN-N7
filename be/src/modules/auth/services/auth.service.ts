import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  GoogleAccountConflictException,
  UserEmailConflictException,
} from '../../users/exceptions/user.exceptions';
import { UserEntity, UserStatus } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import { LoginRequest } from '../dtos/requests/login.request';
import { RegisterRequest } from '../dtos/requests/register.request';
import {
  AccountUnavailableException,
  GoogleAccountLinkRequiredException,
  InvalidCredentialsException,
  InvalidGoogleStateException,
  InvalidSessionException,
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

const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

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
  ) {}

  register(input: RegisterRequest): Promise<UserEntity> {
    return this.usersService.create({
      username: input.username,
      email: input.email,
      password: input.password,
      status: UserStatus.ACTIVE,
    });
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
