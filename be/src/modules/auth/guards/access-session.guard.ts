import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { InvalidSessionException } from '../exceptions/auth.exceptions';
import { AuthService } from '../services/auth.service';

export const ACCESS_COOKIE = 'login_access';
export const REFRESH_COOKIE = 'login_refresh';

@Injectable()
export class AccessSessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[ACCESS_COOKIE] as unknown;
    if (typeof token !== 'string' || !token) {
      throw new InvalidSessionException();
    }
    request.authUser = await this.authService.authenticate(token);
    return true;
  }
}
