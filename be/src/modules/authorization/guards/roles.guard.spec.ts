import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';
import { AuthorizationDeniedException } from '../exceptions/authorization.exceptions';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const request: {
    authUser?: { id: string; role: UserRole };
  } = {
    authUser: {
      id: '11111111-1111-4111-8111-111111111111',
      role: UserRole.TOURIST,
    },
  };
  const context = {
    getHandler: () => RolesGuard,
    getClass: () => RolesGuard,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as jest.Mocked<Reflector>;
  const guard = new RolesGuard(reflector);

  beforeEach(() => jest.clearAllMocks());

  it('allows a public endpoint without an authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true);
    delete request.authUser;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a user whose role is listed on the endpoint', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([UserRole.ADMIN]);
    request.authUser = {
      id: '11111111-1111-4111-8111-111111111111',
      role: UserRole.ADMIN,
    };

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects an authenticated user with the wrong role', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([UserRole.ADMIN]);
    request.authUser = {
      id: '11111111-1111-4111-8111-111111111111',
      role: UserRole.TOURIST,
    };

    expect(() => guard.canActivate(context)).toThrow(
      AuthorizationDeniedException,
    );
  });
});
