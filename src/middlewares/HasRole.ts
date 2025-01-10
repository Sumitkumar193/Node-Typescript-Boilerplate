import { Request, Response, NextFunction } from 'express';
import ApiException from '../errors/ApiException';
import { Role, User } from '@prisma/client';

const UNAUTHORIZED_MESSAGE = 'Unauthorized';
const FORBIDDEN_MESSAGE = 'Access Denied';

export default function HasRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.body.user as User | undefined;
      if (!user) {
        throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
      }
      const userRole = user.roles;
      if (!userRole || !roles.includes(userRole)) {
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
