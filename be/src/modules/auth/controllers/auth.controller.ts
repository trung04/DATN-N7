import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnsupportedMediaTypeException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import type { UserEntity } from '../../users/entities/user.entity';
import { GoogleAccountEmailMismatchException } from '../../users/exceptions/user.exceptions';
import { Public } from '../../authorization/decorators/public.decorator';
import { UserResponse } from '../../users/dtos/responses/user.response';
import { UserMapper } from '../../users/mappers/user.mapper';
import { CurrentUser } from '../decorators/current-user.decorator';
import { GoogleStartRequest } from '../dtos/requests/google-auth.request';
import { LoginRequest } from '../dtos/requests/login.request';
import { TwoFactorCodeRequest } from '../dtos/requests/two-factor.request';
import { RegisterRequest } from '../dtos/requests/register.request';
import { RegisterHotelOwnerRequest } from '../dtos/requests/register-hotel-owner.request';
import { EmailOtpRequest } from '../dtos/requests/email-otp.request';
import { RequestPasswordResetRequest, ResetPasswordRequest } from '../dtos/requests/request-password-reset.request';
import {
  AccountUnavailableException,
  GoogleAccountLinkRequiredException,
  GoogleAuthenticationFailedException,
  GoogleAuthenticationUnavailableException,
  InvalidGoogleStateException,
  InvalidSessionException,
} from '../exceptions/auth.exceptions';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../guards/access-session.guard';
import { TrustedOriginGuard } from '../guards/trusted-origin.guard';
import { AuthService } from '../services/auth.service';
import { TwoFactorService } from '../services/two-factor.service';

const TWO_FACTOR_COOKIE = 'login_2fa';
const TWO_FACTOR_COOKIE_MAX_AGE_MS = 5 * 60 * 1000;

@ApiTags('Authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Post('register')
  @Public()
  async register(
    @Body() input: RegisterRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accepted: true }> {
    await this.authService.register(input);
    response.status(HttpStatus.ACCEPTED);
    return { accepted: true };
  }

  @Post('hotel-owners/register')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  async registerHotelOwner(@Body() input: RegisterHotelOwnerRequest): Promise<{ accepted: true }> {
    await this.authService.registerHotelOwner(input);
    return { accepted: true };
  }

  @Post('verify-otp')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyOtp(@Body() input: EmailOtpRequest): Promise<void> {
    await this.authService.verifyEmail(input);
  }

  @Post('verify-otp/session')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async verifyOtpAndLogin(
    @Body() input: EmailOtpRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    if (!request.is('application/json')) throw new UnsupportedMediaTypeException('Expected application/json');
    const session = await this.authService.verifyEmailAndCreateSession(input);
    this.setSessionCookies(response, session);
    return UserMapper.toResponse(session.user);
  }

  @Post('resend-otp')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  async resendOtp(@Body() input: RequestPasswordResetRequest): Promise<{ accepted: true }> {
    await this.authService.resendVerification(input);
    return { accepted: true };
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() input: RequestPasswordResetRequest): Promise<{ accepted: true }> {
    await this.authService.requestPasswordReset(input);
    return { accepted: true };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() input: ResetPasswordRequest): Promise<void> {
    await this.authService.resetPassword(input);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() input: LoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse | { requiresTwoFactor: true }> {
    const result = await this.authService.login(input);
    if ('requiresTwoFactor' in result) {
      this.setTwoFactorCookie(response, result.challengeToken);
      response.status(HttpStatus.ACCEPTED);
      return { requiresTwoFactor: true };
    }
    this.setSessionCookies(response, result);
    return UserMapper.toResponse(result.user);
  }

  @Get('google/start')
  @Public()
  async googleStart(
    @Query() query: GoogleStartRequest,
    @Res() response: Response,
  ): Promise<void> {
    response.redirect(await this.authService.beginGoogleLogin(query.returnTo));
  }

  @Get('google/link/start')
  async googleLinkStart(
    @CurrentUser() user: UserEntity,
    @Query() query: GoogleStartRequest,
    @Res() response: Response,
  ): Promise<void> {
    response.redirect(
      await this.authService.beginGoogleLink(user.id, query.returnTo),
    );
  }

  @Get('google/callback')
  @Public()
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
      if ('requiresTwoFactor' in result) {
        this.setTwoFactorCookie(response, result.challengeToken);
        const destination = new URL(
          '/auth/two-factor',
          this.frontendOrigin(),
        );
        destination.searchParams.set('returnTo', result.returnTo);
        response.redirect(destination.toString());
        return;
      }
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
      if (error instanceof GoogleAccountEmailMismatchException) {
        response.redirect(this.frontendErrorUrl('google_link_email_mismatch'));
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

  @Post('2fa/verify')
  @Public()
  @UseGuards(TrustedOriginGuard)
  @HttpCode(HttpStatus.OK)
  async verifyTwoFactor(
    @Body() input: TwoFactorCodeRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse & { returnTo: string }> {
    const token = this.cookie(request, TWO_FACTOR_COOKIE);
    if (!token) throw new InvalidSessionException();
    const result = await this.authService.completeTwoFactorLogin(
      token,
      input.code,
    );
    this.setSessionCookies(response, result);
    this.clearTwoFactorCookie(response);
    return { ...UserMapper.toResponse(result.user), returnTo: result.returnTo };
  }

  @Post('2fa/setup')
  @UseGuards(TrustedOriginGuard)
  setupTwoFactor(
    @CurrentUser() user: UserEntity,
  ): Promise<{ secret: string; otpauthUri: string }> {
    return this.twoFactorService.beginSetup(user.id);
  }

  @Post('2fa/confirm')
  @UseGuards(TrustedOriginGuard)
  confirmTwoFactor(
    @CurrentUser() user: UserEntity,
    @Body() input: TwoFactorCodeRequest,
  ): Promise<{ recoveryCodes: string[] }> {
    return this.twoFactorService.confirmSetup(user.id, input.code);
  }

  @Post('2fa/recovery-codes')
  @UseGuards(TrustedOriginGuard)
  regenerateTwoFactorRecoveryCodes(
    @CurrentUser() user: UserEntity,
    @Body() input: TwoFactorCodeRequest,
  ): Promise<{ recoveryCodes: string[] }> {
    return this.twoFactorService.regenerateRecoveryCodes(user.id, input.code);
  }

  @Post('2fa/disable')
  @UseGuards(TrustedOriginGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  disableTwoFactor(
    @CurrentUser() user: UserEntity,
    @Body() input: TwoFactorCodeRequest,
  ): Promise<void> {
    return this.twoFactorService.disable(user.id, input.code);
  }

  @Post('refresh')
  @Public()
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
  @Public()
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

  private setTwoFactorCookie(response: Response, token: string): void {
    response.cookie(TWO_FACTOR_COOKIE, token, {
      ...this.cookieOptions('/api/v1/auth/2fa'),
      maxAge: TWO_FACTOR_COOKIE_MAX_AGE_MS,
    });
  }

  private clearTwoFactorCookie(response: Response): void {
    response.clearCookie(
      TWO_FACTOR_COOKIE,
      this.cookieOptions('/api/v1/auth/2fa'),
    );
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
