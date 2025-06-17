import { Request, Response } from 'express';
import RateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '@database/Prisma';

const MAX_ATTEMPTS = parseInt(process.env.LOGIN_THRESHOLD ?? '10', 10);

/**
 * @summary function disables the user account that is attempted to brute force an user's account,
 * Once maximum threshold is reached user's IP is banned for 24 hours and also the account is set
 * to temporarily inactive state after which user can only access the account after resetting the
 * password.
 *
 * To prevent further brute on the same password the password is set to an random uuid. so that only
 * password reset can fix the account.
 */
const LoginRateLimiter = RateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hour
  limit: MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}-${req.body.email}`,
  handler: async (req: Request, res: Response) => {
    const { email } = req.body;

    if (email) {
      const password = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: {
          email,
          disabled: false,
        },
        data: {
          disabled: true,
          password: hashedPassword,
        },
      });
    }

    return res.status(429).json({
      success: false,
      message:
        'Too many login attempts, your account has been temporarily disabled.',
      disabled: true,
    });
  },
});

export default LoginRateLimiter;
