import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';

const { generateToken, validateRequest } = doubleCsrf({
  getSecret: () => {
    if (!process.env.CSRF_SECRET)
      throw new Error('CSRF_SECRET env var is required');
    return process.env.CSRF_SECRET;
  },
  cookieName: 'XSRF-TOKEN',
  cookieOptions: {
    sameSite:
      (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none' | undefined) ??
      'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
    maxAge: parseInt(process.env.COOKIE_TTL ?? '86400', 10) * 1000,
  },
  size: 64,
  getTokenFromRequest: (req) => req.headers['x-xsrf-token'] as string,
});

export function AttachCsrf(req: Request, res: Response): void {
  const token = generateToken(req, res);

  res.status(200).json({
    success: true,
    message: 'CSRF token issued',
    data: { token },
  });
}

// Safe methods never mutate state; endpoints in EXEMPT manage their own token
// lifecycle (refresh runs before a client may hold a CSRF token).
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/refresh']);

// Global guard: runs on every request. Bearer requests can't be forged
// cross-site (browsers don't auto-attach Authorization), so only cookie-auth
// requests are gated. Mirrors Authenticate's precedence: an accessToken cookie
// means cookie auth even if an Authorization header is also present.
export function VerifyCsrf(req: Request, res: Response, next: NextFunction) {
  const isBearer =
    !req.cookies?.accessToken &&
    !!req.headers.authorization?.startsWith('Bearer ');

  if (
    isBearer ||
    CSRF_SAFE_METHODS.has(req.method) ||
    CSRF_EXEMPT_PATHS.has(req.path)
  ) {
    return next();
  }

  try {
    if (validateRequest(req)) {
      return next();
    }
    return res
      .status(403)
      .json({ success: false, message: 'Invalid or missing CSRF token' });
  } catch {
    return res
      .status(403)
      .json({ success: false, message: 'Invalid or missing CSRF token' });
  }
}
