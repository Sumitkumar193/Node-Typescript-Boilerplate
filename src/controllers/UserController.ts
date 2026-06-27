import { NextFunction, Request, Response } from 'express';
import { Prisma, User } from '@prisma/client';
import ApiException from '@errors/ApiException';
import prisma from '@database/Prisma';
import { UserWithRoles } from '@interfaces/AppCommonInterface';
import RedisService from '@services/RedisService';

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

    const SORTABLE = new Set(['id', 'name', 'email', 'createdAt']);
    const dir = sortDir === 'desc' ? 'desc' : 'asc';
    let orderBy: Prisma.UserOrderByWithRelationInput = {};

    if (sortBy && SORTABLE.has(sortBy as string)) {
      orderBy = { [sortBy as string]: dir };
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
    const requestingUser = res.locals.user as UserWithRoles;
    const targetId = parseInt(id, 10);

    const isAdmin = requestingUser.Role?.name?.toLowerCase() === 'admin';
    if (!isAdmin && requestingUser.id !== targetId) {
      throw new ApiException('User not found', 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      omit: { password: true },
    });

    if (!user) {
      throw new ApiException('User not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: { user },
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

    const targetId = parseInt(id, 10);

    await prisma.user.update({
      where: { id: targetId },
      data: { disabled: true },
    });

    try {
      await RedisService.getInstance().del(`user:${targetId}`);
    } catch {
      /* non-fatal */
    }

    return res.status(200).json({
      success: true,
      message: 'User disabled',
    });
  } catch (error) {
    return next(error);
  }
}

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals as { user: UserWithRoles };

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}
