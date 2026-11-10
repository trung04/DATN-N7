import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { UserEntity } from '../../users/entities/user.entity';
import { InvalidSessionException } from '../exceptions/auth.exceptions';
import type { AuthService } from '../services/auth.service';
import { AccessSessionGuard } from './access-session.guard';

describe('AccessSessionGuard', () => {
  const request: {
    cookies: Record<string, string>;
    authUser?: UserEntity;
  } = { cookies: {} };
  const context = {
    getHandler: () => AccessSessionGuard,
    getClass: () => AccessSessionGuard,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const authService = {
    authenticate: jest.fn(),
  } as unknown as jest.Mocked<AuthService>;
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as jest.Mocked<Reflector>;
  const guard = new AccessSessionGuard(authService, reflector);

  beforeEach(() => {
    jest.clearAllMocks();
    request.cookies = {};
    delete request.authUser;
  });

  it('does not require a session for public endpoints', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.authenticate.mock.calls).toHaveLength(0);
  });

  it('rejects a protected endpoint without an access cookie', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      InvalidSessionException,
    );
  });

  it('attaches the current user for a valid session', async () => {
    const user = { id: '11111111-1111-4111-8111-111111111111' } as UserEntity;
    reflector.getAllAndOverride.mockReturnValue(false);
    request.cookies.login_access = 'opaque-token';
    authService.authenticate.mockResolvedValue(user);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.authUser).toBe(user);
  });
});
