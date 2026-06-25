import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';

const { generateToken, validateRequest } = doubleCsrf({
  getSecret: () => {
    if (!process.env.CSRF_SECRET) throw new Error('CSRF_SECRET env var is required');
    return process.env.CSRF_SECRET;
  },
  cookieName: 'XSRF-TOKEN',
  cookieOptions: {
    sameSite: 
      (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none' | undefined) ??
      'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false, // for JavaScript access (like Laravel)
  },
  size: 64,
  getTokenFromRequest: (req) => req.headers['x-xsrf-token'] as string,
});

export function AttachCsrf(req: Request, res: Response): void {
  const token = generateToken(req, res);
  
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // for JavaScript access (like Laravel)
    sameSite:
      (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none' | undefined) ??
      'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: parseInt(process.env.COOKIE_TTL ?? '86400', 10) * 1000,
  });

  res.status(200).json({
    success: true,
    message: 'CSRF token issued',
    data: {
      token,
    },
  });
}

export function VerifyCsrf(req: Request, res: Response, next: NextFunction) {
  try {
    if (validateRequest(req)) {
      return next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Invalid or missing CSRF token',
      });
    }
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or missing CSRF token',
    });
  }
}
