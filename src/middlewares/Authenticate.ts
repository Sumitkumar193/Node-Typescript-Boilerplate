import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import ApiException from '../errors/ApiException';
import AppException from '../errors/AppException';
import { JwtToken } from '../interfaces/AppCommonInterface';
import prisma from '../database/Prisma';

const UNAUTHORIZED_MESSAGE = 'Unauthorized';

export default async function Authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header('Authorization')?.replace('Bearer ', '');

    // If token is not provided
    if (!token) {
      throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
    }

    let decoded: JwtToken | null = null;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtToken;
    } catch {
      throw new AppException(UNAUTHORIZED_MESSAGE, 401);
    }

    // If token is not valid
    if (!decoded) {
      throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
    }

    const tokenRecord = await prisma.userToken.findUnique({
      where: { id: decoded.id },
    });

    // If token is not found or disabled
    if (!tokenRecord || tokenRecord.disabled) {
      throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenRecord.userId, disabled: false },
      include: { roles: true },
    });

    // If user is not found or disabled
    if (!user || user.disabled) {
      throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
    }

    req.body.token = decoded;
    req.body.user = user;

    next();
  } catch (error) {
    if (error instanceof ApiException || error instanceof AppException) {
      res.clearCookie('accessToken');
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}
