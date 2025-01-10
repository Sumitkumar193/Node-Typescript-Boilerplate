import { Request, Response } from 'express';
import ApiException from '../errors/ApiException';
import prisma from '../database/Prisma';

export async function getUsers(req: Request, res: Response) {
  try {
    const { page, limit, offset } = req.body.pagination;

    const usersCount = await prisma.user.count();

    const usersPaginated = await prisma.user.findMany({
      skip: page ?? 0 * offset,
      take: limit,
    });

    return res.status(200).json({
      success: true,
      data: {
        users: usersPaginated,
        meta: {
          page,
          limit,
          total: {
            items: usersCount,
            pages: Math.ceil(usersCount / limit),
          },
        },
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
