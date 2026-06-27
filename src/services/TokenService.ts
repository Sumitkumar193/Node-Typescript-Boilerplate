import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import prisma from '@database/Prisma';
import { UserWithRoles } from '@interfaces/AppCommonInterface';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 30;

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function signAccessToken(payload: { sub: number; sid: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: '15m',
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): {
  sub: number;
  sid: string;
  exp: number;
  iat: number;
} {
  return jwt.verify(token, process.env.JWT_SECRET as string, {
    algorithms: ['HS256'],
  }) as unknown as { sub: number; sid: string; exp: number; iat: number };
}

// Used by WebSocket auth — verifies the JWT and fetches the user in one call.
// Does not check the Redis blacklist; WebSocket connections are authenticated
// at connect time and rely on the 15m access-token window for revocation.
export async function getUserFromToken(
  token: string,
): Promise<UserWithRoles | null> {
  try {
    const decoded = verifyAccessToken(token);
    return prisma.user.findUnique({
      where: { id: decoded.sub, disabled: false },
      omit: { password: true },
      include: { Role: true },
    });
  } catch {
    return null;
  }
}
