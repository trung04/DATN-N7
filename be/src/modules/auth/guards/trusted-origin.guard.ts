import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      request.headers.origin !==
      this.config.getOrThrow<string>('FRONTEND_ORIGIN')
    ) {
      throw new ForbiddenException('Request origin is not allowed.');
    }
    return true;
  }
}
