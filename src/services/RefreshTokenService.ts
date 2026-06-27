import crypto from 'node:crypto';
import prisma from '@database/Prisma';
import ApiException from '@errors/ApiException';
import RedisService from '@services/RedisService';
import {
  hashToken,
  generateRefreshToken,
  signAccessToken,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
} from '@services/TokenService';

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

class RefreshTokenService {
  static async login(userId: number, meta: SessionMeta) {
    const familyId = crypto.randomUUID();
    const raw = generateRefreshToken();
    const tokenHash = hashToken(raw);

    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000,
    );

    const record = await prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 500),
        ip: meta.ip,
      },
    });

    const accessToken = signAccessToken({ sub: userId, sid: record.jti });
    return { accessToken, refreshToken: raw };
  }

  static async refresh(rawRefreshToken: string, meta: SessionMeta) {
    const tokenHash = hashToken(rawRefreshToken);
    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      throw new ApiException('Invalid token', 401);
    }

    if (record.status !== 'ACTIVE') {
      // Reuse detected — revoke entire token family
      console.warn(
        `[auth] Refresh token reuse detected: familyId=${record.familyId} userId=${record.userId}`,
      );
      await prisma.refreshToken.updateMany({
        where: { familyId: record.familyId },
        data: { status: 'REVOKED' },
      });
      throw new ApiException('Invalid token', 401);
    }

    if (record.expiresAt < new Date()) {
      throw new ApiException('Invalid token', 401);
    }

    const owner = await prisma.user.findUnique({
      where: { id: record.userId },
      select: { disabled: true },
    });
    if (!owner || owner.disabled) {
      throw new ApiException('Invalid token', 401);
    }

    const newRaw = generateRefreshToken();
    const newHash = hashToken(newRaw);
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000,
    );

    // CAS: the WHERE status='ACTIVE' ensures only one concurrent request wins.
    // If count=0 a parallel refresh already rotated this token; abort without
    // revoking the family (that would kill the winning request's new token).
    const newRecord = await prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: record.id, status: 'ACTIVE' },
        data: { status: 'ROTATED', lastUsedAt: new Date() },
      });
      if (count === 0) return null;
      return tx.refreshToken.create({
        data: {
          userId: record.userId,
          familyId: record.familyId,
          tokenHash: newHash,
          expiresAt,
          userAgent: meta.userAgent?.slice(0, 500),
          ip: meta.ip,
        },
      });
    });

    if (!newRecord) throw new ApiException('Invalid token', 401);

    const accessToken = signAccessToken({
      sub: record.userId,
      sid: newRecord.jti,
    });
    return { accessToken, refreshToken: newRaw };
  }

  static async logout(sid: string, accessTokenExp: number): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { jti: sid },
      data: { status: 'REVOKED' },
    });

    const ttl = Math.floor(accessTokenExp - Date.now() / 1000);
    if (ttl > 0) {
      try {
        const redis = RedisService.getInstance();
        await redis.set(`blacklist:${sid}`, '1', { EX: ttl });
      } catch (err) {
        console.error(
          '[auth] Failed to write access-token blacklist to Redis:',
          (err as Error).message,
        );
        // DB revocation is the source of truth; Redis failure does not abort logout
      }
    }
  }

  static async cleanup(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count } = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { status: 'ACTIVE', expiresAt: { lt: new Date() } },
          {
            status: { in: ['ROTATED', 'REVOKED'] },
            updatedAt: { lt: thirtyDaysAgo },
          },
        ],
      },
    });

    if (count > 0)
      console.log(`[cron] Deleted ${count} expired/revoked refresh tokens`);
  }

  static async revokeAllSessions(userId: number): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'REVOKED' },
    });
    // ponytail: full immediate revocation of in-flight access tokens would require
    // blacklisting each session's current sid in Redis. That needs a
    // user:<userId>:sids Redis set tracking live sids — ask before implementing.
  }

  static async listSessions(userId: number, currentSid: string) {
    const sessions = await prisma.refreshToken.findMany({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });

    return sessions.map((s) => ({
      jti: s.jti,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      isCurrent: s.jti === currentSid,
    }));
  }

  static async revokeSession(
    userId: number,
    targetJti: string,
    currentSid: string,
    currentAccessTokenExp?: number,
  ): Promise<void> {
    const { count } = await prisma.refreshToken.updateMany({
      where: { jti: targetJti, userId },
      data: { status: 'REVOKED' },
    });

    if (count === 0) throw new ApiException('Session not found', 404);

    const ttl =
      targetJti === currentSid && currentAccessTokenExp != null
        ? Math.floor(currentAccessTokenExp - Date.now() / 1000)
        : ACCESS_TOKEN_TTL_SECONDS;

    if (ttl > 0) {
      try {
        const redis = RedisService.getInstance();
        await redis.set(`blacklist:${targetJti}`, '1', { EX: ttl });
      } catch (err) {
        console.error(
          '[auth] Failed to write session blacklist to Redis:',
          (err as Error).message,
        );
      }
    }
  }
}

export default RefreshTokenService;
