import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import ApiException from '../errors/ApiException';

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () =>
    process.env.SESSION_SECRET ??
    '1dab4aa1e2530410266a183b51ef8d021de2e86e01a0866468b3604296e98272',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(Date.now() + 60 * 15 * 1000),
  },
  size: 64,
});

export function AttachCsrf(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.method === 'GET') {
    const csrfToken = generateToken(req, res);
    res.cookie('XSRF-TOKEN', csrfToken, {
      httpOnly: false, // Client reads this cookie
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 15 * 1000,
    });
  }

  next();
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
