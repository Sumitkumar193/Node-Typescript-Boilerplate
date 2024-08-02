import { Request, Response, NextFunction } from 'express';

export default function Paginate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const defaultPage = 1;
  const defaultLimit = 10;

  const pageParam = req.query.page as string;
  const limitParam = req.query.limit as string;

  const page = parseInt(pageParam, 10) || defaultPage;
  const limit = parseInt(limitParam, 10) || defaultLimit;

  const offset = (page - 1) * limit;

  req.body.pagination = { page, limit, offset };

  next();
}
