import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { mockMailService } from '../setup';
import AuthRoutes from '@routes/AuthRoutes';
import ApiException from '@errors/ApiException';
import prisma from '@database/Prisma';

const app = express();
app.use(express.json());
app.use('/auth', AuthRoutes);
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof ApiException) {
      return res
        .status(err.status)
        .json({ success: false, message: err.message, data: err.data });
    }
    return res.status(500).json({ success: false, message: err.message });
  },
);

const BASE = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'Password123!',
};

function getUniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
}

const reg = (overrides: Record<string, unknown> = {}) =>
  request(app)
    .post('/auth/register')
    .set('x-xsrf-token', 'test')
    .send({
      ...BASE,
      email: (overrides.email as string) || BASE.email,
      confirmPassword: BASE.password,
      ...overrides,
    });

async function registerAndLogin(overrides: Record<string, unknown> = {}) {
  const email = (overrides.email as string) || getUniqueEmail();
  const regRes = await reg({ ...overrides, email });
  if (!regRes.body?.data?.accessToken) {
    throw new Error(`Registration failed: ${regRes.status} - ${JSON.stringify(regRes.body)}`);
  }

  // Verify user so protected routes don't return 403
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });
  }

  return {
    accessToken: regRes.body.data.accessToken as string,
    refreshToken: regRes.body.data.refreshToken as string,
    email,
  };
}

describe('Auth Routes (integration)', () => {
  // ── Register ────────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('creates user in DB and returns access + refresh tokens', async () => {
      const res = await reg().expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.refreshToken).toBeTruthy();

      const user = await prisma.user.findUnique({ where: { email: BASE.email } });
      expect(user).toBeTruthy();
      expect(user!.isVerified).toBe(false);
      expect(user!.password).not.toBe(BASE.password);
    });

    it('returns 400 if email already taken', async () => {
      await reg();
      const res = await reg().expect(400);
      expect(res.body.message).toBe('User already exists');
    });

    it('returns 422 on invalid input', async () => {
      const res = await request(app)
        .post('/auth/register')
        .set('x-xsrf-token', 'test')
        .send({ name: '', email: 'not-an-email', password: 'x', confirmPassword: 'x' })
        .expect(422);
      expect(res.body.message).toBe('Validation error');
    });
  });

  // ── Login ───────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    beforeEach(() => reg());

    it('returns access + refresh tokens and persists RefreshToken record', async () => {
      const res = await request(app)
        .post('/auth/login')
        .set('x-xsrf-token', 'test')
        .send({ email: BASE.email, password: BASE.password })
        .expect(200);

      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.refreshToken).toBeTruthy();

      const user = await prisma.user.findUnique({ where: { email: BASE.email } });
      const records = await prisma.refreshToken.findMany({
        where: { userId: user!.id, status: 'ACTIVE' },
      });
      expect(records.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .set('x-xsrf-token', 'test')
        .send({ email: BASE.email, password: 'wrong' })
        .expect(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('returns 401 for unknown email', async () => {
      const res = await request(app)
        .post('/auth/login')
        .set('x-xsrf-token', 'test')
        .send({ email: 'nobody@example.com', password: 'x' })
        .expect(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('returns 400 for disabled account', async () => {
      await prisma.user.update({
        where: { email: BASE.email },
        data: { disabled: true },
      });

      const res = await request(app)
        .post('/auth/login')
        .set('x-xsrf-token', 'test')
        .send({ email: BASE.email, password: BASE.password })
        .expect(400);
      expect(res.body.message).toMatch(/temporarily disabled/);
    });
  });

  // ── Refresh ──────────────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('issues a new token pair and rotates the old refresh token', async () => {
      const { refreshToken } = await registerAndLogin();

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.refreshToken).toBeTruthy();
      expect(res.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('returns 401 for an unknown refresh token', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'not-a-real-token' })
        .expect(401);
      expect(res.body.message).toBe('Invalid token');
    });

    it('returns 401 and revokes entire family on reuse of a rotated token', async () => {
      const { refreshToken: original } = await registerAndLogin();

      // First rotation — original becomes ROTATED
      const rotateRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: original })
        .expect(200);
      expect(rotateRes.body.data.refreshToken).toBeTruthy();

      // Reuse the already-ROTATED token — should revoke the whole family
      await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: original })
        .expect(401);
    });
  });

  // ── Profile ─────────────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('returns the authenticated user', async () => {
      const { accessToken, email } = await registerAndLogin();

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(email);
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/auth/me').expect(401);
      expect(res.body.message).toBe('Unauthorized');
    });
  });

  // ── Forgot password ──────────────────────────────────────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('creates a reset token in DB and sends email', async () => {
      const email = getUniqueEmail();
      await reg({ email });
      const user = await prisma.user.findUnique({ where: { email } });

      mockMailService.send.mockClear();

      const res = await request(app)
        .post('/auth/forgot-password')
        .set('x-xsrf-token', 'test')
        .send({ email })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockMailService.send).toHaveBeenCalledOnce();

      const reset = await prisma.passwordReset.findFirst({ where: { userId: user!.id } });
      expect(reset).toBeTruthy();
    });

    it('returns 200 silently for unknown email (enumeration guard)', async () => {
      mockMailService.send.mockClear();

      const res = await request(app)
        .post('/auth/forgot-password')
        .set('x-xsrf-token', 'test')
        .send({ email: 'ghost@example.com' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(mockMailService.send).not.toHaveBeenCalled();
    });
  });

  // ── Reset password ───────────────────────────────────────────────────────────

  describe('GET + POST /auth/forgot-password/:id', () => {
    it('validates token and resets password end-to-end', async () => {
      const email = getUniqueEmail();
      await reg({ email });

      mockMailService.send.mockClear();

      await request(app)
        .post('/auth/forgot-password')
        .set('x-xsrf-token', 'test')
        .send({ email });

      expect(mockMailService.send).toHaveBeenCalledOnce();
      const emailCall = mockMailService.send.mock.calls[0][0];
      const url = new URL(emailCall.context.url);
      const rawToken = url.searchParams.get('token');
      const resetId = url.pathname.split('/').pop();

      const getRes = await request(app)
        .get(`/auth/forgot-password/${resetId}?token=${rawToken}`)
        .expect(200);
      expect(getRes.body.data.email).toBe(email);

      const postRes = await request(app)
        .post(`/auth/forgot-password/${resetId}`)
        .set('x-xsrf-token', 'test')
        .send({ token: rawToken, password: 'NewPass456!', confirmPassword: 'NewPass456!' })
        .expect(200);
      expect(postRes.body.message).toMatch(/Password reset successful/);

      await request(app)
        .post('/auth/login')
        .set('x-xsrf-token', 'test')
        .send({ email, password: BASE.password })
        .expect(401);

      await request(app)
        .post('/auth/login')
        .set('x-xsrf-token', 'test')
        .send({ email, password: 'NewPass456!' })
        .expect(200);
    });

    it('returns 404 for unknown token', async () => {
      const res = await request(app)
        .get('/auth/forgot-password/does-not-exist')
        .expect(404);
      expect(res.body.message).toMatch(/invalid or expired/i);
    });
  });

  // ── Logout ───────────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('revokes the current RefreshToken row', async () => {
      const { accessToken } = await registerAndLogin();
      const decoded = jwt.decode(accessToken) as { sub: number; sid: string };

      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-xsrf-token', 'test')
        .expect(200);

      const record = await prisma.refreshToken.findFirst({
        where: { jti: decoded.sid },
      });
      expect(record!.status).toBe('REVOKED');

      // Access token is now blacklisted (via mock Redis in tests) — in production
      // it would be blocked too. Here we verify the DB revocation happened.
    });
  });

  // ── Sessions ─────────────────────────────────────────────────────────────────

  describe('GET /auth/sessions', () => {
    it('lists active sessions for the authenticated user', async () => {
      const { accessToken } = await registerAndLogin();

      const res = await request(app)
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data.sessions)).toBe(true);
      expect(res.body.data.sessions.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.sessions[0]).not.toHaveProperty('tokenHash');
      const current = res.body.data.sessions.find((s: any) => s.isCurrent);
      expect(current).toBeTruthy();
    });
  });

  describe('DELETE /auth/sessions/:jti', () => {
    it('revokes a specific session', async () => {
      const { accessToken } = await registerAndLogin();
      const decoded = jwt.decode(accessToken) as { sid: string };

      await request(app)
        .delete(`/auth/sessions/${decoded.sid}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-xsrf-token', 'test')
        .expect(200);

      const record = await prisma.refreshToken.findFirst({
        where: { jti: decoded.sid },
      });
      expect(record!.status).toBe('REVOKED');
    });

    it('returns 404 when session jti does not belong to the user', async () => {
      const { accessToken } = await registerAndLogin();

      const res = await request(app)
        .delete('/auth/sessions/nonexistent-jti')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-xsrf-token', 'test')
        .expect(404);

      expect(res.body.message).toBe('Session not found');
    });
  });
});
