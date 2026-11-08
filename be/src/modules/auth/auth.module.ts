import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { AUTH_SESSION_STORE } from './interfaces/auth-session-store.interface';
import { RedisAuthSessionStore } from './integrations/redis/redis-auth-session.store';
import { AccessSessionGuard } from './guards/access-session.guard';
import { TrustedOriginGuard } from './guards/trusted-origin.guard';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessSessionGuard,
    TrustedOriginGuard,
    {
      provide: AUTH_SESSION_STORE,
      useClass: RedisAuthSessionStore,
    },
  ],
  exports: [AuthService, AccessSessionGuard],
})
export class AuthModule {}
