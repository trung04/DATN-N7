import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { AccessSessionGuard } from '../auth/guards/access-session.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [AuthModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AccessSessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AuthorizationModule {}
