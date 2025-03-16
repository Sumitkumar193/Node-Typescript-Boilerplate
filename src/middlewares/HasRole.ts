import { Request, Response, NextFunction } from 'express';
import { Roles, User } from '@prisma/client';
import ApiException from '../errors/ApiException';

const UNAUTHORIZED_MESSAGE = 'Unauthorized';
const FORBIDDEN_MESSAGE = 'Access Denied';

export default function HasRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.body.user as User & { roles: Roles };

      if (!user) {
        throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
      }

      // Check if user has required role
      if (!user.roles || !roles.includes(user.roles.name)) {
        throw new ApiException(FORBIDDEN_MESSAGE, 403);
      }

      return next();
    } catch (error) {
      if (error instanceof ApiException) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }
      throw error;
    }
  };
}
