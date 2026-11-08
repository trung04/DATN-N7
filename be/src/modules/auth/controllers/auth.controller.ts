import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { UserResponse } from '../../users/dtos/responses/user.response';
import { UserMapper } from '../../users/mappers/user.mapper';
import { LoginRequest } from '../dtos/requests/login.request';
import { RegisterRequest } from '../dtos/requests/register.request';
import { AuthService } from '../services/auth.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  ACCESS_COOKIE,
  AccessSessionGuard,
  REFRESH_COOKIE,
} from '../guards/access-session.guard';
import { TrustedOriginGuard } from '../guards/trusted-origin.guard';
import { InvalidSessionException } from '../exceptions/auth.exceptions';
import type { UserEntity } from '../../users/entities/user.entity';

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
    const result = await this.authService.refresh(refreshToken);
    this.setSessionCookies(response, result);
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

  private cookie(request: Request, name: string): string | undefined {
    const value = request.cookies?.[name] as unknown;
    return typeof value === 'string' && value ? value : undefined;
  }
}
