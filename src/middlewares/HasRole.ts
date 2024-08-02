import { Request, Response, NextFunction } from 'express';
import ApiException from '../errors/ApiException';
import { JwtToken } from '../interfaces/AppCommonInterface';
import { IUserRoleEnum } from '../interfaces/UserInterface';

const UNAUTHORIZED_MESSAGE = 'Unauthorized';
const FORBIDDEN_MESSAGE = 'Access Denied';

export default function HasRole(...roles: IUserRoleEnum[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.body.token as JwtToken;
      if (!user) {
        throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
      }
      const userRole = user.role;
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
