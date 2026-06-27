import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before vi.mock() factory calls
// ---------------------------------------------------------------------------
const { mockPrisma, mockRedis } = vi.hoisted(() => ({
  mockPrisma: {
    $transaction: vi.fn(),
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@database/Prisma', () => ({ default: mockPrisma }));
vi.mock('@services/RedisService', () => ({
  default: { getInstance: () => mockRedis },
}));

// ---------------------------------------------------------------------------
// Subject under test (imported after mocks are wired)
// ---------------------------------------------------------------------------
import RefreshTokenService from '@services/RefreshTokenService';
import { ACCESS_TOKEN_TTL_SECONDS } from '@services/TokenService';
import { verifyAccessToken } from '@services/TokenService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const NOW_S = Math.floor(Date.now() / 1000);
const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    jti: 'test-jti',
    familyId: 'test-family',
    userId: 42,
    tokenHash: 'hashed',
    status: 'ACTIVE',
    expiresAt: FUTURE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastUsedAt: null,
    userAgent: null,
    ip: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Interactive $transaction: invoke the callback with mockPrisma as the tx client
  mockPrisma.$transaction.mockImplementation((fn: any) => fn(mockPrisma));
});

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------
describe('RefreshTokenService.login', () => {
  it('creates a RefreshToken row and returns token pair', async () => {
    const record = makeRecord({ jti: 'new-jti' });
    mockPrisma.refreshToken.create.mockResolvedValue(record);

    const result = await RefreshTokenService.login(42, {});

    expect(mockPrisma.refreshToken.create).toHaveBeenCalledOnce();
    const createArg = mockPrisma.refreshToken.create.mock.calls[0][0].data;
    expect(createArg.userId).toBe(42);
    expect(createArg.tokenHash).toBeTruthy();
    expect(createArg.familyId).toBeTruthy();

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();

    // Access token must decode with correct sub + sid
    const decoded = verifyAccessToken(result.accessToken);
    expect(decoded.sub).toBe(42);
    expect(decoded.sid).toBe('new-jti');
  });

  it('truncates userAgent to 500 chars', async () => {
    mockPrisma.refreshToken.create.mockResolvedValue(makeRecord());
    await RefreshTokenService.login(1, { userAgent: 'x'.repeat(600) });
    const ua = mockPrisma.refreshToken.create.mock.calls[0][0].data.userAgent;
    expect(ua?.length).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// refresh — normal rotation
// ---------------------------------------------------------------------------
describe('RefreshTokenService.refresh — normal rotation', () => {
  it('marks old row ROTATED, inserts new ACTIVE row with same familyId', async () => {
    const oldRecord = makeRecord({ jti: 'old-jti', familyId: 'fam-1' });
    const newRecord = makeRecord({ id: 2, jti: 'new-jti', familyId: 'fam-1' });

    mockPrisma.refreshToken.findUnique.mockResolvedValue(oldRecord);
    mockPrisma.user.findUnique.mockResolvedValue({ disabled: false });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 }); // CAS wins
    mockPrisma.refreshToken.create.mockResolvedValue(newRecord);

    const result = await RefreshTokenService.refresh('raw-token', {});

    // old row → ROTATED via CAS (updateMany WHERE id AND status='ACTIVE')
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, status: 'ACTIVE' },
        data: expect.objectContaining({ status: 'ROTATED' }),
      }),
    );

    // new row → ACTIVE, same familyId
    const createArg = mockPrisma.refreshToken.create.mock.calls[0][0].data;
    expect(createArg.familyId).toBe('fam-1');
    expect(createArg.status).toBeUndefined(); // Prisma default handles ACTIVE

    // returned access token has new sid
    const decoded = verifyAccessToken(result.accessToken);
    expect(decoded.sid).toBe('new-jti');
    expect(result.refreshToken).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// refresh — reuse detection
// ---------------------------------------------------------------------------
describe('RefreshTokenService.refresh — reuse detection', () => {
  it('revokes entire family and throws 401 when token is ROTATED', async () => {
    const rotatedRecord = makeRecord({ status: 'ROTATED', familyId: 'fam-stolen' });
    mockPrisma.refreshToken.findUnique.mockResolvedValue(rotatedRecord);

    await expect(RefreshTokenService.refresh('stale-raw', {})).rejects.toMatchObject({
      status: 401,
    });

    // entire family revoked
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'fam-stolen' },
      data: { status: 'REVOKED' },
    });

    // no new token created
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('revokes entire family when token is already REVOKED', async () => {
    const revokedRecord = makeRecord({ status: 'REVOKED', familyId: 'fam-2' });
    mockPrisma.refreshToken.findUnique.mockResolvedValue(revokedRecord);

    await expect(RefreshTokenService.refresh('revoked-raw', {})).rejects.toMatchObject({
      status: 401,
    });

    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'fam-2' },
      data: { status: 'REVOKED' },
    });
  });
});

// ---------------------------------------------------------------------------
// refresh — expired token
// ---------------------------------------------------------------------------
describe('RefreshTokenService.refresh — expired', () => {
  it('returns 401 without mutating any row', async () => {
    const expired = makeRecord({ expiresAt: new Date(Date.now() - 1000) });
    mockPrisma.refreshToken.findUnique.mockResolvedValue(expired);

    await expect(RefreshTokenService.refresh('expired-raw', {})).rejects.toMatchObject({
      status: 401,
    });

    expect(mockPrisma.refreshToken.update).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------
describe('RefreshTokenService.logout', () => {
  it('revokes DB row and sets Redis key with TTL ≈ remaining access-token life', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    mockRedis.set.mockResolvedValue('OK');

    const futureExp = NOW_S + 600; // 10 minutes remaining
    await RefreshTokenService.logout('test-sid', futureExp);

    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { jti: 'test-sid' },
      data: { status: 'REVOKED' },
    });

    const [key, val, opts] = mockRedis.set.mock.calls[0];
    expect(key).toBe('blacklist:test-sid');
    expect(val).toBe('1');
    // TTL should be within a few seconds of 600
    expect(opts.EX).toBeGreaterThan(595);
    expect(opts.EX).toBeLessThanOrEqual(600);
  });

  it('skips Redis write when access token is already expired', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const pastExp = NOW_S - 10;
    await RefreshTokenService.logout('test-sid', pastExp);

    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('does not throw when Redis write fails — DB revocation is source of truth', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    mockRedis.set.mockRejectedValue(new Error('Redis down'));

    await expect(
      RefreshTokenService.logout('test-sid', NOW_S + 300),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Authenticate middleware — via TokenService utilities
// ---------------------------------------------------------------------------
describe('verifyAccessToken', () => {
  it('throws on a garbage token without touching Redis', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow();
  });

  it('throws on an expired token', () => {
    // sign a token that expired 1 second ago
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign(
      { sub: 1, sid: 'x' },
      process.env.JWT_SECRET ?? 'test-secret',
      { expiresIn: -1, algorithm: 'HS256' },
    );
    expect(() => verifyAccessToken(expired)).toThrow();
  });

  it('returns payload for a valid token', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { sub: 99, sid: 'abc' },
      process.env.JWT_SECRET ?? 'test-secret',
      { expiresIn: '15m', algorithm: 'HS256' },
    );
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(99);
    expect(decoded.sid).toBe('abc');
    expect(decoded.exp).toBeGreaterThan(NOW_S);
  });
});

// ---------------------------------------------------------------------------
// revokeSession
// ---------------------------------------------------------------------------
describe('RefreshTokenService.revokeSession', () => {
  it('throws 404 when session not found for user', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      RefreshTokenService.revokeSession(1, 'no-such-jti', 'current-sid'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('uses exact remaining TTL when revoking own session', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    mockRedis.set.mockResolvedValue('OK');

    const futureExp = NOW_S + 400;
    await RefreshTokenService.revokeSession(1, 'my-jti', 'my-jti', futureExp);

    const [, , opts] = mockRedis.set.mock.calls[0];
    expect(opts.EX).toBeGreaterThan(395);
    expect(opts.EX).toBeLessThanOrEqual(400);
  });

  it('uses ACCESS_TOKEN_TTL_SECONDS as upper bound when revoking another device', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    mockRedis.set.mockResolvedValue('OK');

    await RefreshTokenService.revokeSession(1, 'other-jti', 'my-jti');

    const [, , opts] = mockRedis.set.mock.calls[0];
    expect(opts.EX).toBe(ACCESS_TOKEN_TTL_SECONDS);
  });
});
