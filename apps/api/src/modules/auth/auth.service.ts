import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRoles } from '../../common/constants/roles';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { randomBytes, randomUUID } from 'crypto';
import type { AuthTokens, JwtPayload, RequestUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailOtpService } from './email-otp.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Carries a short machine-readable reason so the OAuth callback can redirect to
 * the login page with something more useful than a single generic message.
 */
export class GoogleAuthError extends UnauthorizedException {
  constructor(
    readonly reason: string,
    message: string,
    errorCode: string = ErrorCodes.INVALID_CREDENTIALS,
  ) {
    super({ errorCode, message });
  }
}

type GoogleClaims = {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  aud?: string;
  iss?: string;
  exp?: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
    private readonly emailOtp: EmailOtpService,
  ) {}

  async register(
    dto: RegisterDto,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: RequestUser; tokens: AuthTokens }> {
    const email = dto.email.trim().toLowerCase();
    const role = dto.role ?? UserRoles.CUSTOMER;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        errorCode: ErrorCodes.EMAIL_ALREADY_REGISTERED,
        message: 'An account with this email already exists.',
      });
    }

    /*
      The address must have been confirmed by code first. Checked before the
      password is hashed, since bcrypt is the expensive part of this request and
      an unverified caller should not be able to spend it.

      The marker is only read here and consumed once the account exists — a
      failure later in this method would otherwise burn the verification and
      force the user to start over.
    */
    if (!(await this.emailOtp.isVerified(email))) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.EMAIL_NOT_VERIFIED,
        message: 'Confirm your email address before creating an account.',
      });
    }

    if (dto.phone) {
      const phoneTaken = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (phoneTaken) {
        throw new ConflictException({
          errorCode: ErrorCodes.PHONE_ALREADY_REGISTERED,
          message: 'An account with this phone number already exists.',
        });
      }
    }

    const passwordHash = await this.passwords.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: dto.name.trim(),
          phone: dto.phone,
          role,
        },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
        },
      });

      if (role === UserRoles.OWNER) {
        await tx.ownerProfile.create({
          data: { userId: created.id },
        });
      }

      return created;
    });

    // Spend the verification now that the account exists, so one emailed code
    // cannot be replayed into a second signup.
    await this.emailOtp.consumeVerification(email);

    const tokens = await this.issueSession(user, context);
    return { user, tokens };
  }

  async login(
    dto: LoginDto,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: RequestUser; tokens: AuthTokens }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    const matches = await this.passwords.compareOrDummy(
      dto.password,
      user?.passwordHash,
    );
    if (!user || !matches) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.ACCOUNT_DISABLED,
        message: 'This account has been disabled.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const publicUser: RequestUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const tokens = await this.issueSession(publicUser, context);
    return { user: publicUser, tokens };
  }

  async loginWithGoogleCode(
    code: string,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: RequestUser; tokens: AuthTokens }> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.error(
        'Google sign-in needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI to all be set.',
      );
      throw new GoogleAuthError(
        'google_not_configured',
        'Google sign-in is not configured.',
      );
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    // Google puts the real cause (redirect_uri_mismatch, invalid_client,
    // invalid_grant) in the response body, so log it instead of discarding it.
    const tokenBody = await tokenResponse.text();
    if (!tokenResponse.ok) {
      this.logger.error(
        `Google token exchange failed (HTTP ${tokenResponse.status}) for redirect_uri ${redirectUri}: ${tokenBody.slice(0, 500)}`,
      );
      throw new GoogleAuthError(
        'google_token_exchange',
        'Google sign-in could not be verified.',
      );
    }

    let tokens: { access_token?: string; id_token?: string };
    try {
      tokens = JSON.parse(tokenBody) as typeof tokens;
    } catch {
      this.logger.error('Google token response was not valid JSON.');
      throw new GoogleAuthError(
        'google_token_exchange',
        'Google sign-in could not be verified.',
      );
    }

    const profile =
      this.readGoogleIdToken(tokens.id_token, clientId) ??
      (await this.fetchGoogleProfile(tokens.access_token));

    if (!profile?.sub || !profile.email) {
      this.logger.error(
        'Google returned no usable identity claims (missing sub or email).',
      );
      throw new GoogleAuthError(
        'google_profile',
        'Google profile could not be loaded.',
      );
    }
    if (profile.email_verified !== true && profile.email_verified !== 'true') {
      this.logger.warn(
        `Rejected Google sign-in for an unverified email: ${profile.email}`,
      );
      throw new GoogleAuthError(
        'google_email_unverified',
        'A verified Google email is required.',
      );
    }

    const email = profile.email.trim().toLowerCase();
    let user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, name: true, isActive: true },
    });
    if (user && !user.isActive) {
      throw new GoogleAuthError(
        'account_disabled',
        'This account has been disabled.',
        ErrorCodes.ACCOUNT_DISABLED,
      );
    }
    if (user && user.role === UserRoles.ADMIN) {
      // Mirrors the password/OTP forms: admins sign in from /admin only.
      throw new GoogleAuthError(
        'google_admin',
        'Admin accounts must sign in from the admin page.',
      );
    }
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: profile.name?.trim() || email.split('@')[0],
          passwordHash: await this.passwords.hash(
            randomBytes(32).toString('hex'),
          ),
          role: UserRoles.CUSTOMER,
        },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          isActive: true,
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    const publicUser: RequestUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    this.logger.log(`Google sign-in succeeded for ${email}.`);
    return {
      user: publicUser,
      tokens: await this.issueSession(publicUser, context),
    };
  }

  /**
   * Reads the identity claims out of Google's id_token. The token arrives over
   * TLS straight from the token endpoint, authenticated with our client secret,
   * so the signature is already implied; what still has to be checked is that
   * the token was minted for *this* client and has not expired.
   */
  private readGoogleIdToken(
    idToken: string | undefined,
    clientId: string,
  ): GoogleClaims | null {
    const payload = idToken?.split('.')[1];
    if (!payload) {
      return null;
    }
    let claims: GoogleClaims;
    try {
      claims = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as GoogleClaims;
    } catch {
      this.logger.warn('Google id_token payload could not be decoded.');
      return null;
    }
    if (claims.aud !== clientId) {
      this.logger.error(
        `Google id_token audience ${String(claims.aud)} does not match GOOGLE_CLIENT_ID.`,
      );
      return null;
    }
    if (!claims.iss || !GOOGLE_ISSUERS.includes(claims.iss)) {
      this.logger.error(
        `Google id_token issuer ${String(claims.iss)} is not Google.`,
      );
      return null;
    }
    if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) {
      this.logger.error('Google id_token has already expired.');
      return null;
    }
    return claims;
  }

  private async fetchGoogleProfile(
    accessToken: string | undefined,
  ): Promise<GoogleClaims | null> {
    if (!accessToken) {
      this.logger.error('Google token response contained no access_token.');
      return null;
    }
    const response = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) {
      this.logger.error(
        `Google userinfo request failed (HTTP ${response.status}): ${(await response.text()).slice(0, 300)}`,
      );
      return null;
    }
    return (await response.json()) as GoogleClaims;
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async refresh(
    refreshToken: string | undefined,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: RequestUser; tokens: AuthTokens }> {
    if (!refreshToken) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.INVALID_REFRESH_TOKEN,
        message: 'Refresh token is missing.',
      });
    }

    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!existing) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.INVALID_REFRESH_TOKEN,
        message: 'Refresh token is invalid.',
      });
    }

    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        errorCode: ErrorCodes.REFRESH_TOKEN_REUSE,
        message: 'Refresh token reuse was detected. Please sign in again.',
      });
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.INVALID_REFRESH_TOKEN,
        message: 'Refresh token has expired.',
      });
    }

    if (!existing.user.isActive) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.ACCOUNT_DISABLED,
        message: 'This account has been disabled.',
      });
    }

    const publicUser: RequestUser = {
      id: existing.user.id,
      email: existing.user.email,
      role: existing.user.role,
      name: existing.user.name,
    };

    const tokens = await this.issueSession(publicUser, context, {
      familyId: existing.familyId,
      replacesId: existing.id,
    });

    return { user: publicUser, tokens };
  }

  issueSession(
    user: RequestUser,
    context: { userAgent?: string; ipAddress?: string },
    rotation?: { familyId: string; replacesId: string },
  ): Promise<AuthTokens> {
    return this.issueTokens(user, context, rotation);
  }

  async me(userId: string): Promise<RequestUser & { phone: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Authentication is required.',
      });
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      phone: user.phone,
    };
  }

  async updateMe(
    userId: string,
    dto: { name?: string; phone?: string },
  ): Promise<RequestUser & { phone: string | null }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.phone ? { phone: dto.phone } : {}),
      },
    });
    return this.me(userId);
  }

  getRefreshCookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('COOKIE_SECURE', false),
      sameSite: 'lax' as const,
      path: '/api/auth',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    };
  }

  private async issueTokens(
    user: RequestUser,
    context: { userAgent?: string; ipAddress?: string },
    rotation?: { familyId: string; replacesId: string },
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.tokens.signAccessToken(payload);
    const refreshToken = this.tokens.createRefreshToken();
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const id = randomUUID();
    const familyId = rotation?.familyId ?? randomUUID();

    await this.prisma.$transaction(async (tx) => {
      if (rotation) {
        const rotated = await tx.refreshToken.updateMany({
          where: { id: rotation.replacesId, revokedAt: null },
          data: { revokedAt: new Date(), replacedById: id },
        });
        if (rotated.count === 0) {
          await tx.refreshToken.updateMany({
            where: { familyId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          throw new UnauthorizedException({
            errorCode: ErrorCodes.REFRESH_TOKEN_REUSE,
            message: 'Refresh token reuse was detected. Please sign in again.',
          });
        }
      }

      await tx.refreshToken.create({
        data: {
          id,
          userId: user.id,
          familyId,
          tokenHash,
          expiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE_MS),
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
        },
      });
    });

    return { accessToken, refreshToken };
  }
}
