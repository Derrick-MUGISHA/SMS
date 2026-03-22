import { Role } from '@prisma/client';

export type AccessJwtPayload = {
  sub: string;
  email: string;
  role: Role;
};

export type RefreshJwtPayload = AccessJwtPayload & {
  typ: 'refresh';
};

export type PasswordResetJwtPayload = {
  sub: string;
  typ: 'pwd_reset';
};
