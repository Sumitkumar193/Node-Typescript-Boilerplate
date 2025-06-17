import { NextFunction, Request, Response } from 'express';
import { Prisma, User } from '@prisma/client';
import ApiException from '@errors/ApiException';
import prisma from '@database/Prisma';
import TokenService from '@services/TokenService';

export async function getUsers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { page, limit, offset } = res.locals.pagination;
    const { search, sortBy, sortDir } = req.query;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        {
          id: {
            equals: parseInt(search as string, 10),
          },
        },
        {
          name: {
            contains: search as string,
          },
        },
        {
          email: {
            contains: search as string,
          },
        },
      ];
    }

    where.AND = [
      {
        disabled: false,
      },
    ];

    let orderBy: Prisma.UserOrderByWithRelationInput = {};

    if (sortBy && sortDir) {
      orderBy = {
        [sortBy as string]: sortDir as Prisma.SortOrder,
      };
    }

    // Use the paginate extension with proper typing
    const result = await prisma.user.paginate<User>({
      page,
      limit,
      offset,
      where,
      orderBy,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        users: result.data,
        meta: result.meta,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: {
        id: parseInt(id, 10),
      },
    });

    if (!user) {
      throw new ApiException('User not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function disableUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;

    const findUserWithPermission = await prisma.user.findFirst({
      where: {
        AND: {
          id: {
            equals: parseInt(id, 10),
          },
        },
      },
    });

    if (!findUserWithPermission) {
      throw new ApiException(
        'User not found or you do not have permission to disable this user',
        404,
      );
    }

    const user = await prisma.user.update({
      where: {
        id: parseInt(id, 10),
      },
      data: {
        disabled: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'User disabled',
      data: {
        user,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getProfile(req: Request, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.body.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        disabled: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
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

export async function listTokens(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = req.body;

    const UserTokens = await TokenService.getUsersActiveTokens(user);

    const tokens = UserTokens.map((token) => ({
      id: token.id,
      createdAt: token.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        tokens,
      },
    });
  } catch (error) {
    return next(error);
  }
}
