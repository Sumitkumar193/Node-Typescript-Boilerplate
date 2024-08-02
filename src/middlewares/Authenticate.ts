import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import ApiException from '../errors/ApiException';
import AppException from '../errors/AppException';
import { JwtToken } from '../interfaces/AppCommonInterface';

const UNAUTHORIZED_MESSAGE = 'Unauthorized';

export default function Authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const accessToken = req.headers.authorization;
    if (!accessToken) {
      throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
    }

    const token = accessToken.split(' ')[1];

    let decoded: JwtToken | null = null;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtToken;
    } catch {
      throw new AppException(UNAUTHORIZED_MESSAGE, 401);
    }

    if (!decoded) {
      throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
    }

    req.body.token = decoded;

    next();
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}
