import { Request, Response, NextFunction } from 'express';
import ApiException from '@errors/ApiException';

const UNAUTHORIZED_MESSAGE = 'Unauthorized';
const FORBIDDEN_MESSAGE = 'Access Denied';

export default function HasRole(...roleNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user } = res.locals;
      if (!user) {
        throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
      }

      // const hasAnyRole = await prisma.user.hasRole(user.id, roleNames);
      
      let hasAnyRole = false;
      for (const userRole of user.UserRoles) {
        if (roleNames.includes(userRole.Role.name)) {
          hasAnyRole = true;
          break;
        }
      }

      if (!hasAnyRole) {
        throw new ApiException(FORBIDDEN_MESSAGE, 403);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
