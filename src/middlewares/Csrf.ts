import { Request, Response, NextFunction } from 'express';
import { doubleCsrf, SameSiteType } from 'csrf-csrf';
import ApiException from '../errors/ApiException';

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () =>
    process.env.SESSION_SECRET ??
    '1dab4aa1e2530410266a183b51ef8d021de2e86e01a0866468b3604296e98272',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: (process.env.COOKIE_SAME_SITE as SameSiteType) ?? 'none',
    secure: process.env.NODE_ENV === 'production',
    maxAge: parseInt(process.env.COOKIE_TTL ?? '86400', 10) * 1000,
    expires: new Date(
      Date.now() + parseInt(process.env.COOKIE_TTL ?? '86400', 10) * 1000,
    ),
  },
  size: 64,
});

export function AttachCsrf(req: Request, res: Response): void {
  if (req.method === 'GET') {
    const csrfToken = generateToken(req, res);
    res.cookie('XSRF-TOKEN', csrfToken, {
      httpOnly: false,
      sameSite: (process.env.COOKIE_SAME_SITE as SameSiteType) ?? 'none',
      secure: process.env.NODE_ENV === 'production',
      maxAge: parseInt(process.env.COOKIE_TTL ?? '86400', 10) * 1000,
    });
    res.status(200).json({
      success: true,
      message: 'CSRF token attached',
      token: csrfToken,
    });
  } else {
    res.status(405).json({ success: false, message: 'Method not allowed' });
  }
}

export function VerifyCsrf(
  req: Request,
  res: Response,
  next: NextFunction,
): void | Response {
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return next();
    }
    const token = req.headers['x-csrf-token'] as string;

    if (!token) {
      throw new ApiException('CSRF token missing or invalid', 403);
    }

    doubleCsrfProtection(req, res, next);
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({ message: error.message });
    }
    throw error;
  }
}
