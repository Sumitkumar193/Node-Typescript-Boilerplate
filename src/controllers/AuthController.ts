import { Request, Response } from 'express';
import { User, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import ApiException from '../errors/ApiException';
import prisma from '../database/Prisma';
import {
  createUserValidation,
  loginValidation,
} from '../validations/UserValidation';
import validate from '../services/ValidationService';
import TokenService from '../services/TokenService';

export async function createUser(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;

    const { hasError, errors } = validate(createUserValidation, req.body);

    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const checkUserExists = await prisma.user.findUnique({ where: { email } });

    if (!checkUserExists) {
      throw new ApiException('User already exists', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user: User = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roles: Role.USER,
      },
    });

    const token = await TokenService.generateUserToken(user);

    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24,
    });

    return res.status(201).json({
      success: true,
      message: 'User created',
      data: {
        user: {
          name: user.name,
          email: user.email,
        },
        token,
      },
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: error.data,
      });
    }
    throw error;
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    const { hasError, errors } = validate(loginValidation, { email, password });

    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const user: User | null = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new ApiException('User not found', 404);
    }

    const verifyPassword = await bcrypt.compare(password, user.password);

    if (!verifyPassword) {
      throw new ApiException('Invalid password', 401);
    }

    const token = await TokenService.generateUserToken(user);

    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: (process.env.NODE_ENV as string) === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24,
    });

    return res.status(200).json({
      success: true,
      message: 'User logged in',
      data: {
        user: {
          name: user.name,
          email: user.email,
        },
        token,
      },
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: error.data,
      });
    }
    throw error;
  }
}

export async function logoutUser(req: Request, res: Response) {
  try {
    const { token } = req.body;

    await TokenService.logoutUser(token);

    res.clearCookie('accessToken');

    return res.status(200).json({
      success: true,
      message: 'User logged out',
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

export async function logoutFromAllDevices(req: Request, res: Response) {
  try {
    const { user } = req.body;

    await TokenService.logoutFromAllDevices(user);

    res.clearCookie('accessToken');

    return res.status(200).json({
      success: true,
      message: 'User logged out from all devices',
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
