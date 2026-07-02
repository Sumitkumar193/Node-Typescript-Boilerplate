import { Request, Response, NextFunction } from 'express';
import ApiException from '@errors/ApiException';
import AppException from '@errors/AppException';
import { verifyAccessToken } from '@services/TokenService';
import RedisService from '@services/RedisService';
import prisma from '@database/Prisma';
import { UserWithRoles } from '@interfaces/AppCommonInterface';

const UNAUTHORIZED = 'Unauthorized';

export default async function Authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    let rawToken: string;
    let authMethod: 'cookie' | 'bearer';

    if (req.cookies?.accessToken) {
      authMethod = 'cookie';
      rawToken = req.cookies.accessToken;
    } else if (req.headers.authorization?.startsWith('Bearer ')) {
      authMethod = 'bearer';
      rawToken = req.headers.authorization.substring(7);
    } else {
      throw new ApiException(UNAUTHORIZED, 401);
    }

    res.locals.authMethod = authMethod;

    let decoded: { sub: number; sid: string; exp: number; iat: number };
    try {
      decoded = verifyAccessToken(rawToken);
    } catch {
      // Expired or invalid signature — no Redis call needed
      throw new AppException(UNAUTHORIZED, 401);
    }

    // Single GET — fail open if Redis is unreachable so a Redis outage doesn't
    // block every API call. DB revocation via RefreshToken.status covers future
    // refresh attempts; the access-token window (15m) is the exposure period.
    // Decision flagged here because no existing Redis-down convention was found in this repo.
    try {
      const redis = RedisService.getInstance();
      const blacklisted = await redis.get(`blacklist:${decoded.sid}`);
      if (blacklisted) {
        throw new ApiException(UNAUTHORIZED, 401);
      }
    } catch (err) {
      if (err instanceof ApiException) throw err;
      console.error(
        '[auth] Redis blacklist check failed, failing open:',
        (err as Error).message,
      );
    }

    let user: UserWithRoles | null = null;
    try {
      const redis = RedisService.getInstance();
      const cached = await redis.get(`user:${decoded.sub}`);
      if (cached) user = JSON.parse(cached) as UserWithRoles;
    } catch {
      /* Redis down, fall through to DB */
    }

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        omit: { password: true },
        include: { Role: true },
      });
      if (user) {
        try {
          const redis = RedisService.getInstance();
          // 60s TTL — stale window before a disabled flag propagates
          await redis.set(`user:${decoded.sub}`, JSON.stringify(user), {
            EX: 60,
          });
        } catch {
          /* Redis down, skip cache write */
        }
      }
    }

    if (!user || user.disabled) {
      throw new ApiException(UNAUTHORIZED, 401);
    }

    if (
      process.env.REQUIRE_EMAIL_VERIFICATION as string === 'true' &&
      !user.isVerified &&
      !req.originalUrl.includes('/auth/verify')
    ) {
      throw new ApiException(
        'User account is not verified. Please verify your email.',
        403,
      );
    }

    res.locals.token = decoded;
    res.locals.user = user;

    next();
  } catch (error) {
    if (error instanceof ApiException || error instanceof AppException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}
