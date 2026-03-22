import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MessageResponseDto } from '../common/swagger/message-response.dto';
import { AuthService } from './auth.service';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MS,
} from './auth.constants';
import { buildCookieOptions } from './cookie-options';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a new student account',
    description:
      'Creates an unverified user and stores a bcrypt-hashed OTP (logged to console until mailer is wired). Duplicate emails return a generic conflict.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiConflictResponse({
    description: 'Could not register (e.g. email already in use)',
  })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('verify-otp')
  @ApiOperation({
    summary: 'Verify email with OTP',
    description: '6-digit code, valid for 10 minutes after registration.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid or expired verification code',
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.email, dto.otp);
  }

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Sign in; sets httpOnly access and refresh cookies',
    description:
      '`access_token` cookie path `/`; `refresh_token` cookie path `/auth` (used by POST /auth/refresh). JSON body returns a short confirmation only.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    type: MessageResponseDto,
    description:
      'Also sets Set-Cookie headers for access_token and refresh_token (httpOnly).',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials (generic; no account enumeration)',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.auth.login(
      dto.email,
      dto.password,
    );
    res.cookie(
      ACCESS_TOKEN_COOKIE,
      accessToken,
      buildCookieOptions(this.config, ACCESS_TOKEN_MS, '/'),
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      buildCookieOptions(this.config, REFRESH_TOKEN_MS, '/auth'),
    );
    return { message: 'Login successful' };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary: 'Rotate tokens using refresh cookie (path /auth)',
    description:
      'Send the request with the `refresh_token` cookie (Swagger: you may need to call from a browser or attach Cookie header manually). Rotates refresh and re-hashes it in the database.',
  })
  @ApiOkResponse({
    type: MessageResponseDto,
    description: 'Issues new access and refresh cookies.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw: unknown = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const { accessToken, refreshToken } = await this.auth.refreshTokens(
      typeof raw === 'string' ? raw : undefined,
    );
    res.cookie(
      ACCESS_TOKEN_COOKIE,
      accessToken,
      buildCookieOptions(this.config, ACCESS_TOKEN_MS, '/'),
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      buildCookieOptions(this.config, REFRESH_TOKEN_MS, '/auth'),
    );
    return { message: 'Tokens refreshed' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @Post('logout')
  @ApiOperation({
    summary: 'Clear session cookies and invalidate refresh token',
    description:
      'Requires a valid access JWT (cookie or Authorization header).',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async logout(
    @Req() req: Request & { user: { id: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.user.id);
    res.clearCookie(
      ACCESS_TOKEN_COOKIE,
      buildCookieOptions(this.config, 0, '/'),
    );
    res.clearCookie(
      REFRESH_TOKEN_COOKIE,
      buildCookieOptions(this.config, 0, '/auth'),
    );
    return { message: 'Logged out' };
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Always returns the same message whether or not the email exists. Reset token is logged to console until mailer exists.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({
    summary: 'Complete password reset',
    description:
      'Uses JWT issued from forgot-password flow (15-minute expiry).',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or expired reset token' })
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }
}
