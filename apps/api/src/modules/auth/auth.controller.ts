import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_COOKIE } from './auth.types';
import type { RequestUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
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
