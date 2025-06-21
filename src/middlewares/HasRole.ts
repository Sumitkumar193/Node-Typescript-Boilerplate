import { Request, Response, NextFunction } from 'express';
import ApiException from '@errors/ApiException';
import { UserWithRoles } from '@customTypes/custom';

const UNAUTHORIZED_MESSAGE = 'Unauthorized';
const FORBIDDEN_MESSAGE = 'Access Denied';

export default function HasRole(...roleNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user } = res.locals as { user: UserWithRoles } ;
      if (!user) {
        throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
      }

      const allowedRoles = roleNames.map((r) => r.toLowerCase());
      const hasAnyRole =
        Array.isArray(user.UserRoles) &&
        user.UserRoles.some(
          (userRole) =>
            userRole.Role &&
            allowedRoles.includes(userRole.Role.name.toLowerCase())
        );

      if (!hasAnyRole) {
        throw new ApiException(FORBIDDEN_MESSAGE, 403);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
