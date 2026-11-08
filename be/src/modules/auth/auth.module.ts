import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { AccessSessionGuard } from './guards/access-session.guard';
import { TrustedOriginGuard } from './guards/trusted-origin.guard';
import { GoogleIdentityClient } from './integrations/google/google-identity.provider';
import { RedisAuthStore } from './integrations/redis/redis-auth.store';
import { AUTH_SESSION_STORE } from './interfaces/auth-session-store.interface';
import { GOOGLE_IDENTITY_PROVIDER } from './interfaces/google-identity-provider.interface';
import { GOOGLE_OAUTH_STATE_STORE } from './interfaces/google-oauth-state-store.interface';
import { AuthService } from './services/auth.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessSessionGuard,
    TrustedOriginGuard,
    RedisAuthStore,
    GoogleIdentityClient,
    {
      provide: AUTH_SESSION_STORE,
      useExisting: RedisAuthStore,
    },
    {
      provide: GOOGLE_OAUTH_STATE_STORE,
      useExisting: RedisAuthStore,
    },
    {
      provide: GOOGLE_IDENTITY_PROVIDER,
      useExisting: GoogleIdentityClient,
    },
  ],
  exports: [AuthService, AccessSessionGuard],
})
export class AuthModule {}
