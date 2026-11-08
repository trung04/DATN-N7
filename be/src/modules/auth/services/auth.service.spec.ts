import {
  UserEntity,
  UserRole,
  UserStatus,
} from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import {
  InvalidCredentialsException,
  InvalidSessionException,
} from '../exceptions/auth.exceptions';
import type { AuthSessionStore } from '../interfaces/auth-session-store.interface';
import { AuthService } from './auth.service';

const user = Object.assign(new UserEntity(), {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'traveler',
  email: 'traveler@example.com',
  passwordHash: '$2b$12$hashed',
  googleAccountId: null,
  status: UserStatus.ACTIVE,
  role: UserRole.TOURIST,
});

const tokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessExpiresInMs: 60000,
  refreshExpiresInMs: 120000,
};

describe('AuthService', () => {
  let usersService: {
    create: jest.Mock;
    validateCredentials: jest.Mock;
    findActiveById: jest.Mock;
  };
  let sessions: jest.Mocked<AuthSessionStore>;
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      validateCredentials: jest.fn(),
      findActiveById: jest.fn(),
    };
    sessions = {
      create: jest.fn(),
      validateAccess: jest.fn(),
      rotate: jest.fn(),
      revokeByTokens: jest.fn(),
      revokeFamily: jest.fn(),
    };
    service = new AuthService(
      usersService as unknown as UsersService,
      sessions,
    );
  });

  it('registers an active tourist through the users capability', async () => {
    usersService.create.mockResolvedValue(user);

    await expect(
      service.register({
        username: 'traveler',
        email: 'traveler@example.com',
        password: 'Password123',
      }),
    ).resolves.toBe(user);
    expect(usersService.create).toHaveBeenCalledWith({
      username: 'traveler',
      email: 'traveler@example.com',
      password: 'Password123',
      status: UserStatus.ACTIVE,
    });
  });

  it('creates an access and refresh session after valid credentials', async () => {
    usersService.validateCredentials.mockResolvedValue(user);
    sessions.create.mockResolvedValue(tokens);

    await expect(
      service.login({ username: 'traveler', password: 'Password123' }),
    ).resolves.toEqual({ user, ...tokens });
    expect(sessions.create.mock.calls).toContainEqual([user.id]);
  });

  it('rejects invalid credentials without creating a session', async () => {
    usersService.validateCredentials.mockResolvedValue(null);

    await expect(
      service.login({ username: 'traveler', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
    expect(sessions.create.mock.calls).toHaveLength(0);
  });

  it('authenticates a valid access session for an active user', async () => {
    sessions.validateAccess.mockResolvedValue({
      userId: user.id,
      familyId: 'family-id',
    });
    usersService.findActiveById.mockResolvedValue(user);

    await expect(service.authenticate('access-token')).resolves.toBe(user);
  });

  it('revokes a session family when its user is no longer active', async () => {
    sessions.validateAccess.mockResolvedValue({
      userId: user.id,
      familyId: 'family-id',
    });
    usersService.findActiveById.mockResolvedValue(null);

    await expect(service.authenticate('access-token')).rejects.toBeInstanceOf(
      InvalidSessionException,
    );
    expect(sessions.revokeFamily.mock.calls).toContainEqual(['family-id']);
  });

  it('returns a rotated session and rejects invalid refresh tokens', async () => {
    sessions.rotate.mockResolvedValue({
      status: 'rotated',
      userId: user.id,
      familyId: 'family-id',
      ...tokens,
    });
    usersService.findActiveById.mockResolvedValue(user);

    await expect(service.refresh('old-refresh')).resolves.toEqual({
      user,
      ...tokens,
    });

    sessions.rotate.mockResolvedValue({ status: 'reused' });
    await expect(service.refresh('used-refresh')).rejects.toBeInstanceOf(
      InvalidSessionException,
    );
  });

  it('revokes the session identified by logout cookies', async () => {
    await service.logout('access-token', 'refresh-token');
    expect(sessions.revokeByTokens.mock.calls).toContainEqual([
      'access-token',
      'refresh-token',
    ]);
  });
});
