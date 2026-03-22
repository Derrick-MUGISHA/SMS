import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

export function buildCookieOptions(
  config: ConfigService,
  maxAge: number,
  path: string,
): CookieOptions {
  const secure = config.get<string>('NODE_ENV') === 'production';
  const raw = config.get<string>('COOKIE_SAMESITE');
  const sameSite: CookieOptions['sameSite'] =
    raw === 'strict' || raw === 'none' || raw === 'lax' ? raw : 'lax';
  return { httpOnly: true, secure, sameSite, maxAge, path };
}
