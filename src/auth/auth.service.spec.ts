import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const jwtSign = jest.fn();
  const jwtVerify = jest.fn();
  const jwtService = {
    sign: jwtSign,
    verify: jwtVerify,
  };
  const config = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_SECRET')
        return 'unit-test-access-secret-32chars!!';
      if (key === 'JWT_REFRESH_SECRET')
        return 'unit-test-refresh-secret-32chars!!';
      throw new Error(`unexpected config key ${key}`);
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtSign
      .mockReturnValueOnce('signed-access')
      .mockReturnValueOnce('signed-refresh');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('creates user and returns success message', async () => {
      prisma.user.create.mockResolvedValue({} as never);

      const res = await service.register({
        email: 'a@b.com',
        password: 'password12',
      });

      expect(res.message).toContain('Registration successful');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'a@b.com',
            isVerified: false,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('throws ConflictException on duplicate email (P2002)', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      });
      prisma.user.create.mockRejectedValue(err);

      await expect(
        service.register({ email: 'a@b.com', password: 'password12' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when credentials invalid', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('missing@test.dev', 'password12'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns tokens and stores hashed refresh when valid', async () => {
      const hash = await bcrypt.hash('password12', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'ok@test.dev',
        password: hash,
        role: 'STUDENT',
        isVerified: true,
        otp: null,
        otpExpires: null,
        hashedRefreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      prisma.user.update.mockResolvedValue({} as never);

      const out = await service.login('ok@test.dev', 'password12');

      expect(out.accessToken).toBe('signed-access');
      expect(out.refreshToken).toBe('signed-refresh');
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshTokens', () => {
    it('throws when refresh token missing', async () => {
      await expect(service.refreshTokens(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws when JWT verify fails', async () => {
      jwtVerify.mockImplementation(() => {
        throw new Error('bad token');
      });

      await expect(service.refreshTokens('x')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('verifyOtp', () => {
    it('throws BadRequestException when user has no pending OTP', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        otp: null,
        otpExpires: null,
      } as never);

      await expect(
        service.verifyOtp('a@b.com', '123456'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('forgotPassword', () => {
    it('returns generic message when user missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await service.forgotPassword('nobody@test.dev');

      expect(res.message).toContain('If that email exists');
    });
  });
});
