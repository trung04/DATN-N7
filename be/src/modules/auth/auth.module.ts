import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { AccessSessionGuard } from './guards/access-session.guard';
import { TrustedOriginGuard } from './guards/trusted-origin.guard';
import { GoogleIdentityClient } from './integrations/google/google-identity.provider';
import { RedisAuthStore } from './integrations/redis/redis-auth.store';
import { RedisAuthChallengeStore } from './integrations/redis/redis-auth-challenge.store';
import { SmtpEmailSender } from './integrations/email/smtp-email.sender';
import { AUTH_SESSION_STORE } from './interfaces/auth-session-store.interface';
import { GOOGLE_IDENTITY_PROVIDER } from './interfaces/google-identity-provider.interface';
import { GOOGLE_OAUTH_STATE_STORE } from './interfaces/google-oauth-state-store.interface';
import { AUTH_CHALLENGE_STORE } from './interfaces/auth-challenge-store.interface';
import { EMAIL_SENDER } from './interfaces/email-sender.interface';
import { AuthService } from './services/auth.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessSessionGuard,
    TrustedOriginGuard,
    RedisAuthStore,
    RedisAuthChallengeStore,
    SmtpEmailSender,
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
      provide: AUTH_CHALLENGE_STORE,
      useExisting: RedisAuthChallengeStore,
    },
    {
      provide: EMAIL_SENDER,
      useExisting: SmtpEmailSender,
    },
    {
      provide: GOOGLE_IDENTITY_PROVIDER,
      useExisting: GoogleIdentityClient,
    },
  ],
  exports: [AuthService, AccessSessionGuard],
})
export class AuthModule {}
