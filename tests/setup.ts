import { vi } from 'vitest';
import { config } from 'dotenv';

config({ path: '.env.test' });

// Point the Prisma adapter at the test database before any module loads
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.NODE_ENV = 'test';

// Only mock external I/O — everything else (DB, auth, validation) runs for real
const mockMailService = { send: vi.fn().mockResolvedValue(undefined), init: vi.fn() };
vi.mock('@services/MailService', () => ({ default: mockMailService, __esModule: true }));

const mockLoginRateLimiter = vi.fn((_req: any, _res: any, next: any) => next());
vi.mock('@middlewares/LoginRateLimiter', () => ({ default: mockLoginRateLimiter, __esModule: true }));

// CSRF: always pass in tests
const mockVerifyCsrf = vi.fn((_req: any, _res: any, next: any) => next());
const mockAttachCsrf = vi.fn((_req: any, _res: any, next: any) => next());
vi.mock('@middlewares/Csrf', () => ({
  VerifyCsrf: mockVerifyCsrf,
  AttachCsrf: mockAttachCsrf,
  __esModule: true,
}));

// Redis: return no blacklist entries so Authenticate middleware passes in integration tests
const mockRedisClient = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
};
vi.mock('@services/RedisService', () => ({
  default: {
    init: vi.fn(),
    getInstance: vi.fn(() => mockRedisClient),
    disconnect: vi.fn(),
  },
  __esModule: true,
}));

// Suppress Prisma query-hook console.log noise
vi.spyOn(console, 'log').mockImplementation(() => {});

export { mockMailService, mockLoginRateLimiter, mockVerifyCsrf, mockAttachCsrf, mockRedisClient };
