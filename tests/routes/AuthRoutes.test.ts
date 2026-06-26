import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { mockMailService } from '../setup';
import AuthRoutes from '@routes/AuthRoutes';
import ApiException from '@errors/ApiException';
import prisma from '@database/Prisma';
import { execSync } from 'child_process';

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

// Generate unique email for each test to avoid conflicts
function getUniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
}

const reg = (overrides = {}) =>
  request(app)
    .post('/auth/register')
    .set('x-xsrf-token', 'test')
    .send({ 
      ...BASE, 
      email: overrides.email || BASE.email,
      confirmPassword: BASE.password, 
      ...overrides 
    });

async function registerAndLogin(overrides = {}) {
  const email = overrides.email || getUniqueEmail();
  const regRes = await reg({ ...overrides, email });
  if (!regRes.body || !regRes.body.data || !regRes.body.data.token) {
    throw new Error(`Registration failed: ${regRes.status} - ${JSON.stringify(regRes.body)}`);
  }
  
  // Automatically verify the user in tests to avoid 403 errors
  const user = await prisma.user.findUnique({
    where: { email },
  });
  
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });
  }
  
  return regRes.body.data.token as string;
}

describe('Auth Routes (integration)', () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "UserToken",
      "UserVerification",
      "PasswordReset",
      "User"
    RESTART IDENTITY CASCADE;
  `);

    mockMailService.send.mockClear();
  });

  // ── Register ────────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('creates user in DB and returns JWT', async () => {
      const res = await reg().expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeTruthy();

      const user = await prisma.user.findUnique({
        where: { email: BASE.email },
      });
      expect(user).toBeTruthy();
      expect(user!.isVerified).toBe(false);
      // password must be hashed, not plain
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
        .send({
          name: '',
          email: 'not-an-email',
          password: 'x',
          confirmPassword: 'x',
        })
        .expect(422);
      expect(res.body.message).toBe('Validation error');
    });
  });

  // ── Login ───────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    beforeEach(() => reg());

    it('returns JWT and persists token record', async () => {
      const res = await request(app)
        .post('/auth/login')
        .set('x-xsrf-token', 'test')
        .send({ email: BASE.email, password: BASE.password })
        .expect(200);

      expect(res.body.data.token).toBeTruthy();

      const user = await prisma.user.findUnique({
        where: { email: BASE.email },
      });
      const tokens = await prisma.userToken.findMany({
        where: { userId: user!.id, disabled: false },
      });
      expect(tokens.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .set('x-xsrf-token', 'test')
        .send({ email: BASE.email, password: 'wrong' })
        .expect(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('returns 404 for unknown email', async () => {
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

  // ── Profile ─────────────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('returns the authenticated user', async () => {
      const email = getUniqueEmail();
      const token = await registerAndLogin({ email });

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
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
      const user = await prisma.user.findUnique({
        where: { email },
      });

      // Clear the mock to ignore the verification email sent during registration
      mockMailService.send.mockClear();

      const res = await request(app)
        .post('/auth/forgot-password')
        .set('x-xsrf-token', 'test')
        .send({ email })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockMailService.send).toHaveBeenCalledOnce();

      const reset = await prisma.passwordReset.findFirst({
        where: { userId: user!.id },
      });
      expect(reset).toBeTruthy();
    });

    it('returns 200 silently for unknown email (enumeration guard)', async () => {
      // Clear any previous mock calls
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
      const user = await prisma.user.findUnique({
        where: { email },
      });

      // Clear the mock to ignore the verification email sent during registration
      mockMailService.send.mockClear();

      // Trigger reset
      await request(app)
        .post('/auth/forgot-password')
        .set('x-xsrf-token', 'test')
        .send({ email });

      // Get the raw token from the email that was sent
      expect(mockMailService.send).toHaveBeenCalledOnce();
      const emailCall = mockMailService.send.mock.calls[0][0];
      const url = new URL(emailCall.context.url);
      const rawToken = url.searchParams.get('token');
      const resetId = url.pathname.split('/').pop();

      // GET — check token is valid
      const getRes = await request(app)
        .get(`/auth/forgot-password/${resetId}?token=${rawToken}`)
        .expect(200);
      expect(getRes.body.data.email).toBe(email);

      // POST — actually reset
      const postRes = await request(app)
        .post(`/auth/forgot-password/${resetId}`)
        .set('x-xsrf-token', 'test')
        .send({ token: rawToken, password: 'NewPass456!', confirmPassword: 'NewPass456!' })
        .expect(200);
      expect(postRes.body.message).toMatch(/Password reset successful/);

      // Old password no longer works
      const loginRes = await request(app)
        .post('/auth/login')
        .set('x-xsrf-token', 'test')
        .send({ email, password: BASE.password })
        .expect(401);
      expect(loginRes.body.message).toBe('Invalid email or password');

      // New password works
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
    it('invalidates the current token', async () => {
      const email = getUniqueEmail();
      const token = await registerAndLogin({ email });
      const decoded = jwt.decode(token) as { id: number };

      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('x-xsrf-token', 'test')
        .expect(200);

      // Token record should now be disabled
      const record = await prisma.userToken.findUnique({
        where: { id: decoded.id },
      });
      expect(record!.disabled).toBe(true);

      // Can no longer use the token
      await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  describe('POST /auth/logout/:id (device logout)', () => {
    it('invalidates a specific device token', async () => {
      const email = getUniqueEmail();
      const token = await registerAndLogin({ email });
      const decoded = jwt.decode(token) as { id: number };

      await request(app)
        .post(`/auth/logout/${decoded.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-xsrf-token', 'test')
        .send({ id: decoded.id })
        .expect(200);

      const record = await prisma.userToken.findUnique({
        where: { id: decoded.id },
      });
      expect(record!.disabled).toBe(true);
    });
  });
});
