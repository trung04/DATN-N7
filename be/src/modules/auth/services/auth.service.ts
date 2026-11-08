import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from '../../users/services/users.service';
import { UserEntity, UserStatus } from '../../users/entities/user.entity';
import { LoginRequest } from '../dtos/requests/login.request';
import { RegisterRequest } from '../dtos/requests/register.request';
import {
  InvalidCredentialsException,
  InvalidSessionException,
} from '../exceptions/auth.exceptions';
import {
  AUTH_SESSION_STORE,
  SessionTokens,
} from '../interfaces/auth-session-store.interface';
import type { AuthSessionStore } from '../interfaces/auth-session-store.interface';

export interface AuthenticatedSession extends SessionTokens {
  user: UserEntity;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    @Inject(AUTH_SESSION_STORE)
    private readonly sessions: AuthSessionStore,
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
}
