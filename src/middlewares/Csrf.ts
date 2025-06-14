import { Request, Response, NextFunction } from 'express';
import csrf from 'csurf';

const csrfProtection = csrf();

export function AttachCsrf(req: Request, res: Response): void {
  res.cookie('XSRF-TOKEN', req.csrfToken(), {
    httpOnly: false, // for JavaScript access (like Laravel)
    sameSite: (process.env.COOKIE_SAME_SITE as any) ?? 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: parseInt(process.env.COOKIE_TTL ?? '86400', 10) * 1000,
  });

  res.status(200).json({
    success: true,
    message: 'CSRF token issued',
    data: {
      token: req.csrfToken(),
    },
  });
}

export function VerifyCsrf(req: Request, res: Response, next: NextFunction) {
  return csrfProtection(req, res, (err: any) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or missing CSRF token',
      });
    }
    next();
  });
}
