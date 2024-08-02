import { Request, Response } from 'express';
import ApiException from '../errors/ApiException';
import { IUser, IUserRoleEnum } from '../interfaces/UserInterface';

const users: IUser[] = [];

export async function createUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const checkUserExists = users.find((user) => user.email === email);

    if (checkUserExists) {
      throw new ApiException('User already exists', 400);
    }

    users.push({ email, password, role: IUserRoleEnum.Staff });
    return res.status(201).json({
      success: true,
      message: 'User created',
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

export async function getUsers(req: Request, res: Response) {
  try {
    const { page, limit, offset } = req.body.pagination;
    const usersPaginated = users.slice(offset, offset + limit);

    return res.status(200).json({
      success: true,
      data: {
        users: usersPaginated,
        meta: {
          page,
          limit,
          total: {
            items: users.length,
            pages: Math.ceil(users.length / limit),
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
