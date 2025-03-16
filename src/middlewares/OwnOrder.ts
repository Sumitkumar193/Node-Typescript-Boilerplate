import { Request, Response, NextFunction } from 'express';
import ApiException from '../errors/ApiException';

export default function OwnOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { user, params } = req.body;

  if (
    user.role !== 'Admin' &&
    user.role !== 'Moderator' &&
    user.id !== params.userId
  ) {
    throw new ApiException('Access denied', 403);
  }

  next();
}
