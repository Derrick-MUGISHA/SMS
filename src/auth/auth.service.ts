import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import {
  ACCESS_TOKEN_MS,
  BCRYPT_COST,
  PASSWORD_RESET_MS,
  REFRESH_TOKEN_MS,
} from './auth.constants';
import type {
  AccessJwtPayload,
  PasswordResetJwtPayload,
  RefreshJwtPayload,
} from './types/jwt-payload.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private accessSecret(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private refreshSecret(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private signAccessToken(payload: AccessJwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.accessSecret(),
      expiresIn: ACCESS_TOKEN_MS / 1000,
    });
  }

  private signRefreshToken(payload: RefreshJwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.refreshSecret(),
      expiresIn: REFRESH_TOKEN_MS / 1000,
    });
  }

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_COST);
    const otp = this.generateOtp();
    const hashedOtp = await bcrypt.hash(otp, BCRYPT_COST);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    try {
      await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          otp: hashedOtp,
          otpExpires,
          isVerified: false,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Unable to complete registration.');
      }
      throw e;
    }

    // TODO: integrate mailer
    console.log(`OTP for ${dto.email}: ${otp}`);

    return {
      message: 'Registration successful. Please check your email for the OTP.',
    };
  }

  async verifyOtp(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.otp || !user.otpExpires || new Date() > user.otpExpires) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const ok = await bcrypt.compare(otp, user.otp);
    if (!ok) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, otp: null, otpExpires: null },
    });

    return { message: 'Email verified successfully' };
  }

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid =
      user && user.isVerified && (await bcrypt.compare(pass, user.password));
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = this.signRefreshToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      typ: 'refresh',
    });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, BCRYPT_COST);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string | undefined) {
    if (!refreshToken?.length) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let payload: RefreshJwtPayload;
    try {
      payload = this.jwtService.verify<RefreshJwtPayload>(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user?.hashedRefreshToken) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const newRefresh = this.signRefreshToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      typ: 'refresh',
    });
    const hashedRefreshToken = await bcrypt.hash(newRefresh, BCRYPT_COST);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken },
    });

    return { accessToken, refreshToken: newRefresh };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
    return { message: 'Logged out' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = this.jwtService.sign(
        { sub: user.id, typ: 'pwd_reset' } satisfies PasswordResetJwtPayload,
        {
          secret: this.refreshSecret(),
          expiresIn: PASSWORD_RESET_MS / 1000,
        },
      );
      // TODO: send email with token
      console.log(`Password reset token for ${email}: ${token}`);
    }
    return {
      message:
        'If that email exists in our system, password reset instructions have been sent.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    let payload: PasswordResetJwtPayload;
    try {
      payload = this.jwtService.verify<PasswordResetJwtPayload>(token, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }
    if (payload.typ !== 'pwd_reset') {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.prisma.user.update({
      where: { id: payload.sub },
      data: {
        password: hashed,
        hashedRefreshToken: null,
      },
    });

    return { message: 'Password has been reset. Please sign in again.' };
  }
}
