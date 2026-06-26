import request from 'supertest';
import express from 'express';
import UserRoutes from '@routes/UserRoutes';
import ApiException from '@errors/ApiException';
import AuthRoutes from '@routes/AuthRoutes';
import prisma from '@database/Prisma';

// Mount both routers so login works in the same app instance
const app = express();
app.use(express.json());
app.use('/auth', AuthRoutes);
app.use('/users', UserRoutes);
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
  email: 'user@example.com',
  password: 'Password123!',
};

// Generate unique email for each test to avoid conflicts
function getUniqueEmail() {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
}

async function createUser(overrides = {}) {
  const email = overrides.email || getUniqueEmail();
  const data = {
    ...BASE,
    email,
    ...overrides,
    confirmPassword: (overrides as any).password ?? BASE.password,
  };
  const res = await request(app)
    .post('/auth/register')
    .set('x-xsrf-token', 'test')
    .send(data);
    
  if (!res.body || !res.body.data || !res.body.data.token) {
    throw new Error(`User creation failed: ${res.status} - ${JSON.stringify(res.body)}`);
  }
  
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  return { token: res.body.data.token as string, user: user! };
}

async function makeAdmin(userId: number) {
  const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
  await prisma.user.update({
    where: { id: userId },
    data: { roleId: adminRole!.id },
  });
}

describe('User Routes (integration)', () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "UserToken",
      "UserVerification",
      "PasswordReset",
      "User"
    RESTART IDENTITY CASCADE;
  `);
  });

  // ── GET /users ───────────────────────────────────────────────────────────────

  describe('GET /users', () => {
    it('returns paginated user list for Admin', async () => {
      const { token, user } = await createUser();
      await makeAdmin(user.id);

      const res = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
      // passwords must not leak
      expect(res.body.data.users[0].password).toBeUndefined();
    });

    it('returns 403 for non-Admin user', async () => {
      const { token } = await createUser();

      const res = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.message).toBe('Access Denied');
    });

    it('returns 401 without token', async () => {
      await request(app).get('/users').expect(401);
    });
  });

  // ── GET /users/:id ───────────────────────────────────────────────────────────

  describe('GET /users/:id', () => {
    it('returns user by ID without password', async () => {
      const email = getUniqueEmail();
      const { token, user } = await createUser({ email });

      const res = await request(app)
        .get(`/users/${user.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('returns 404 for non-existent user', async () => {
      const email = getUniqueEmail();
      const { token } = await createUser({ email });

      const res = await request(app)
        .get('/users/999999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(res.body.message).toBe('User not found');
    });
  });

  // ── POST /users/:id/disable ──────────────────────────────────────────────────

  describe('POST /users/:id/disable', () => {
    it('Admin can disable another user', async () => {
      const targetEmail = getUniqueEmail();
      const { user: target } = await createUser({
        email: targetEmail,
        password: BASE.password,
      });
      const adminEmail = getUniqueEmail();
      const { token, user: admin } = await createUser({
        email: adminEmail,
        password: BASE.password,
      });
      await makeAdmin(admin.id);

      const res = await request(app)
        .post(`/users/${target.id}/disable`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-xsrf-token', 'test')
        .expect(200);

      expect(res.body.message).toBe('User disabled');

      const updated = await prisma.user.findUnique({
        where: { id: target.id },
      });
      expect(updated!.disabled).toBe(true);
    });

    it('returns 403 for non-Admin', async () => {
      const targetEmail = getUniqueEmail();
      const { user: target } = await createUser({
        email: targetEmail,
        password: BASE.password,
      });
      const regularEmail = getUniqueEmail();
      const { token } = await createUser({
        email: regularEmail,
        password: BASE.password,
      });

      await request(app)
        .post(`/users/${target.id}/disable`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-xsrf-token', 'test')
        .expect(403);
    });

    it('returns 404 when user does not exist', async () => {
      const adminEmail = getUniqueEmail();
      const { token, user: admin } = await createUser({ email: adminEmail });
      await makeAdmin(admin.id);

      const res = await request(app)
        .post('/users/999999/disable')
        .set('Authorization', `Bearer ${token}`)
        .set('x-xsrf-token', 'test')
        .expect(404);

      expect(res.body.message).toMatch(/not found/i);
    });
  });
});
