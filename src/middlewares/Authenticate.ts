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
    const { accessToken } = req.cookies;
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

    const tokenRecord = await prisma.userToken.findUnique({
      where: { id: token },
    });

    if (!tokenRecord || tokenRecord.disabled) {
      throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenRecord.userId, disabled: false },
    });

    if (!user) {
      throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
    }

    req.body.token = decoded;
    req.body.user = user;

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
