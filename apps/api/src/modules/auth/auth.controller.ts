import {
  Body,
  Controller,
  Get,
  Logger,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService, GoogleAuthError } from './auth.service';
import { REFRESH_TOKEN_COOKIE } from './auth.types';
import type { RequestUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { OtpService } from './otp.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: { limit: 20, ttl: 60000 } })
  @Get('google')
  googleStart(@Query('next') next: string | undefined, @Res() response: Response) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const redirectUri = this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI');
    if (!clientId || !redirectUri) {
      this.logger.error(
        'GET /auth/google was called but GOOGLE_CLIENT_ID or GOOGLE_OAUTH_REDIRECT_URI is missing.',
      );
      response.redirect(`${this.webAppUrl()}/auth/login?error=google_not_configured`);
      return;
    }
    const state = randomUUID();
    const safeNext = this.safeNext(next);
    const secure = this.config.get<boolean>('COOKIE_SECURE', false);
    response.cookie('googleOAuthState', state, { httpOnly: true, sameSite: 'lax', secure, maxAge: 10 * 60 * 1000, path: '/api/auth' });
    response.cookie('googleOAuthNext', safeNext, { httpOnly: true, sameSite: 'lax', secure, maxAge: 10 * 60 * 1000, path: '/api/auth' });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    // Online-only access (we never refresh against Google) and an explicit
    // account chooser, so a signed-in Google user can still switch accounts.
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('prompt', 'select_account');
    this.logger.log(`Starting Google sign-in with redirect_uri ${redirectUri}`);
    response.redirect(url.toString());
  }

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: { limit: 20, ttl: 60000 } })
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') googleError: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const cookies = request.cookies as Record<string, string> | undefined;
    const webAppUrl = this.webAppUrl();
    const next = this.safeNext(cookies?.googleOAuthNext);
    response.clearCookie('googleOAuthState', { path: '/api/auth' });
    response.clearCookie('googleOAuthNext', { path: '/api/auth' });

    // Google reports consent-screen problems (access_denied, and crucially
    // redirect_uri_mismatch) as a query parameter rather than an HTTP error.
    if (googleError) {
      this.logger.error(`Google returned an authorization error: ${googleError}`);
      response.redirect(`${webAppUrl}/auth/login?error=${encodeURIComponent(googleError)}`);
      return;
    }
    if (!code) {
      this.logger.error('Google callback arrived without an authorization code.');
      response.redirect(`${webAppUrl}/auth/login?error=google_no_code`);
      return;
    }
    if (!state || !cookies?.googleOAuthState) {
      this.logger.error(
        'Google callback state cookie was missing. The browser dropped the cookie set at /auth/google — check that the sign-in was started from the same host as GOOGLE_OAUTH_REDIRECT_URI.',
      );
      response.redirect(`${webAppUrl}/auth/login?error=google_state`);
      return;
    }
    if (state !== cookies.googleOAuthState) {
      this.logger.error('Google callback state did not match the stored state.');
      response.redirect(`${webAppUrl}/auth/login?error=google_state`);
      return;
    }

    try {
      const result = await this.auth.loginWithGoogleCode(code, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });
      this.setRefreshCookie(response, result.tokens.refreshToken);
      response.redirect(`${webAppUrl}/auth/google/callback#accessToken=${encodeURIComponent(result.tokens.accessToken)}&next=${encodeURIComponent(next)}`);
    } catch (error) {
      const reason =
        error instanceof GoogleAuthError ? error.reason : 'google_login';
      this.logger.error(
        `Google sign-in failed (${reason}): ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      response.redirect(`${webAppUrl}/auth/login?error=${reason}`);
    }
  }

  private webAppUrl(): string {
    return this.config
      .get<string>('WEB_APP_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
  }

  private safeNext(value: string | undefined): string {
    return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
  }

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: { limit: 30, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(dto, this.context(request));
    this.setRefreshCookie(response, result.tokens.refreshToken);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
    };
  }

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: { limit: 30, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto, this.context(request));
    this.setRefreshCookie(response, result.tokens.refreshToken);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
    };
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[REFRESH_TOKEN_COOKIE];
    await this.auth.logout(refreshToken);
    response.clearCookie(
      REFRESH_TOKEN_COOKIE,
      this.auth.getRefreshCookieOptions(),
    );
    return { loggedOut: true };
  }

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[REFRESH_TOKEN_COOKIE];
    const result = await this.auth.refresh(refreshToken, this.context(request));
    this.setRefreshCookie(response, result.tokens.refreshToken);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
    };
  }

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: { limit: 8, ttl: 60000 } })
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto, @Req() request: Request) {
    return this.otp.request(dto, { ipAddress: request.ip });
  }

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: { limit: 12, ttl: 60000 } })
  @Post('otp/verify')
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.otp.verify(dto, this.context(request));
    this.setRefreshCookie(response, result.tokens.refreshToken);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
    };
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateMeDto) {
    return this.auth.updateMe(user.id, dto);
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      this.auth.getRefreshCookieOptions(),
    );
  }

  private context(request: Request) {
    return {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    };
  }
}
