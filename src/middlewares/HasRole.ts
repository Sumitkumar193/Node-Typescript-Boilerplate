import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import ApiException from '@errors/ApiException';
import prisma from '@database/Prisma';

const UNAUTHORIZED_MESSAGE = 'Unauthorized';
const FORBIDDEN_MESSAGE = 'Access Denied';

export default function HasRole(...roleNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = res.locals.user as User | undefined;
      if (!user) {
        throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
      }

      const hasAnyRole = await prisma.user.hasRole(user.id, roleNames);

      if (!hasAnyRole) {
        throw new ApiException(FORBIDDEN_MESSAGE, 403);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
