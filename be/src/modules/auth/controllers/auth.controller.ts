import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import type { UserEntity } from '../../users/entities/user.entity';
import { UserResponse } from '../../users/dtos/responses/user.response';
import { UserMapper } from '../../users/mappers/user.mapper';
import { CurrentUser } from '../decorators/current-user.decorator';
import { GoogleStartRequest } from '../dtos/requests/google-auth.request';
import { LoginRequest } from '../dtos/requests/login.request';
import { RegisterRequest } from '../dtos/requests/register.request';
import {
  AccountUnavailableException,
  GoogleAccountLinkRequiredException,
  GoogleAuthenticationFailedException,
  GoogleAuthenticationUnavailableException,
  InvalidGoogleStateException,
  InvalidSessionException,
} from '../exceptions/auth.exceptions';
import {
  ACCESS_COOKIE,
  AccessSessionGuard,
  REFRESH_COOKIE,
} from '../guards/access-session.guard';
import { TrustedOriginGuard } from '../guards/trusted-origin.guard';
import { AuthService } from '../services/auth.service';

@ApiTags('Authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() input: RegisterRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    const user = await this.authService.register(input);
    response.setHeader('Location', `/api/v1/users/${user.id}`);
    return UserMapper.toResponse(user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() input: LoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    const result = await this.authService.login(input);
    this.setSessionCookies(response, result);
    return UserMapper.toResponse(result.user);
  }

  @Get('google/start')
  async googleStart(
    @Query() query: GoogleStartRequest,
    @Res() response: Response,
  ): Promise<void> {
    response.redirect(await this.authService.beginGoogleLogin(query.returnTo));
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Query('error') error: unknown,
    @Res() response: Response,
  ): Promise<void> {
    if (typeof error === 'string' && error.length <= 100) {
      response.redirect(this.frontendErrorUrl('google_cancelled'));
      return;
    }
    if (
      typeof code !== 'string' ||
      !code ||
      code.length > 4096 ||
      typeof state !== 'string' ||
      !state ||
      state.length > 128
    ) {
      response.redirect(this.frontendErrorUrl('google_failed'));
      return;
    }
    try {
      const result = await this.authService.completeGoogleLogin(code, state);
      this.setSessionCookies(response, result);
      const destination = new URL(
        '/auth/google/complete',
        this.frontendOrigin(),
      );
      destination.searchParams.set('returnTo', result.returnTo);
      response.redirect(destination.toString());
    } catch (error) {
      if (error instanceof GoogleAccountLinkRequiredException) {
        response.redirect(this.frontendErrorUrl('account_link_required'));
        return;
      }
      if (
        error instanceof InvalidGoogleStateException ||
        error instanceof GoogleAuthenticationFailedException ||
        error instanceof GoogleAuthenticationUnavailableException ||
        error instanceof AccountUnavailableException
      ) {
        response.redirect(this.frontendErrorUrl('google_failed'));
        return;
      }
      throw error;
    }
  }

  @Post('refresh')
  @UseGuards(TrustedOriginGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = request.cookies?.[REFRESH_COOKIE] as unknown;
    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new InvalidSessionException();
    }
    this.setSessionCookies(
      response,
      await this.authService.refresh(refreshToken),
    );
  }

  @Post('logout')
  @UseGuards(TrustedOriginGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(
      this.cookie(request, ACCESS_COOKIE),
      this.cookie(request, REFRESH_COOKIE),
    );
    this.clearSessionCookies(response);
  }

  @Get('me')
  @UseGuards(AccessSessionGuard)
  me(@CurrentUser() user: UserEntity): UserResponse {
    return UserMapper.toResponse(user);
  }

  private setSessionCookies(
    response: Response,
    session: {
      accessToken: string;
      refreshToken: string;
      accessExpiresInMs: number;
      refreshExpiresInMs: number;
    },
  ): void {
    response.cookie(ACCESS_COOKIE, session.accessToken, {
      ...this.cookieOptions('/'),
      maxAge: session.accessExpiresInMs,
    });
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...this.cookieOptions('/api/v1/auth'),
      maxAge: session.refreshExpiresInMs,
    });
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(ACCESS_COOKIE, this.cookieOptions('/'));
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions('/api/v1/auth'));
  }

  private cookieOptions(path: string): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path,
    };
  }

  private frontendErrorUrl(error: string): string {
    const destination = new URL('/auth/login', this.frontendOrigin());
    destination.searchParams.set('error', error);
    return destination.toString();
  }

  private frontendOrigin(): string {
    return this.config.getOrThrow<string>('FRONTEND_ORIGIN');
  }

  private cookie(request: Request, name: string): string | undefined {
    const value = request.cookies?.[name] as unknown;
    return typeof value === 'string' && value ? value : undefined;
  }
}
