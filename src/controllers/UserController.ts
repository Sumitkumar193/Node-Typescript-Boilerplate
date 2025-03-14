import { Prisma, User } from '@prisma/client';
import { Request, Response } from 'express';
import ApiException from '../errors/ApiException';
import prisma from '../database/Prisma';

export async function getUsers(req: Request, res: Response) {
  try {
    const { search, sortBy, sortDir } = req.query;
    const { page, limit, offset } = req.body.pagination;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        {
          id: {
            equals: search as string,
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
        disabled: true,
        createdAt: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
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
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        disabled: true,
        createdAt: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
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
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function disableUser(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        disabled: true,
        createdAt: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
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
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}
