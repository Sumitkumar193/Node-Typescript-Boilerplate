import { NextFunction, Request, Response } from 'express';
import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import ApiException from '../errors/ApiException';
import prisma from '../database/Prisma';
import {
  createUserValidation,
  forgotPasswordValidation,
  loginValidation,
  passwordResetValidation,
} from '../validations/UserValidation';
import validate from '../services/ValidationService';
import TokenService from '../services/TokenService';
import MailService from '../services/MailService';

export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, password, name } = req.body;

    const { hasError, errors } = validate(createUserValidation, req.body);

    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const checkUserExists = await prisma.user.findUnique({ where: { email } });

    if (checkUserExists) {
      throw new ApiException('User already exists', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user: User = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    await prisma.user.assignRole(user.id, 'User');

    const token = await TokenService.generateUserToken(user);

    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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
    return next(error);
  }
}

export async function loginUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
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
      throw new ApiException('Invalid email or password', 404);
    }

    if (user.disabled) {
      throw new ApiException(
        'Your account is disabled please contact Administrator.',
        429,
      );
    }

    if (!user.disabled) {
      throw new ApiException(
        'Your account is temporarily disabled, Please reset password to continue.',
        400,
      );
    }

    const verifyPassword = await bcrypt.compare(password, user.password);

    if (!verifyPassword) {
      throw new ApiException('Invalid password', 401);
    }

    const token = await TokenService.generateUserToken(user);

    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: (process.env.NODE_ENV as string) === 'production',
      sameSite: 'lax',
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
    return next(error);
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    const { hasError, errors } = validate(forgotPasswordValidation, { email });

    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new ApiException(
        'Password reset request has been processed successfully.',
        200,
        null,
        true,
      );
    }

    if (user.disabled) {
      throw new ApiException(
        'Your account is disabled please contact Administrator.',
        400,
      );
    }

    const passwordResetToken = await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: crypto.randomBytes(32).toString('hex'),
      },
    });

    const emailData = {
      to: user.email,
      subject: 'Forgot Password',
      message: `Hello ${user.name},
      We have received an request to change password for account.
      Note: If you have not requested for this kindly ignore this email.
      
      Here is link to reset your password:
      ${process.env.FRONTEND_URL}/forgot-password/${passwordResetToken.token}`,
    };

    await MailService.send(emailData);

    return res.status(200).json({
      success: true,
      message: 'Password reset request has been processed successfully',
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: error.success,
        message: error.message,
        data: error.data,
      });
    }

    throw error;
  }
}

export async function getResetPasswordEmail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const passwordValidFor = parseInt(
      process.env.PASSWORD_RESET_TIME ?? '120',
      10,
    ); // in minutes

    const userEmail = await prisma.user.findFirst({
      where: {
        PasswordReset: {
          some: {
            AND: {
              disabled: false,
              token: id,
              createdAt: {
                gte: new Date(Date.now() - passwordValidFor * 60 * 1000),
              },
            },
          },
        },
      },
      select: {
        email: true,
      },
    });

    if (!userEmail) {
      throw new ApiException('Password reset token is invalid or expired', 404);
    }

    return res.status(200).json({
      success: true,
      data: {
        email: userEmail.email,
      },
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: error.success,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { password, confirmPassword } = req.body;
    const passwordValidFor = parseInt(
      process.env.PASSWORD_RESET_TIME ?? '120',
      10,
    ); // in minutes

    const passwordResetToken = await prisma.user.findFirst({
      where: {
        PasswordReset: {
          some: {
            AND: {
              disabled: false,
              token: id,
              createdAt: {
                gte: new Date(Date.now() - passwordValidFor * 60 * 1000),
              },
            },
          },
        },
      },
    });

    if (!passwordResetToken) {
      throw new ApiException('Password reset token is invalid or expired', 404);
    }

    const { hasError, errors } = validate(passwordResetValidation, {
      password,
      confirmPassword,
    });

    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: {
        id: passwordResetToken.id,
      },
      data: {
        disabled: false,
        password: hashedPassword,
      },
    });

    await prisma.passwordReset.updateMany({
      where: {
        token: id,
      },
      data: {
        disabled: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. Please login to your account.',
    });
  } catch (error) {
    return next(error);
  }
}

export async function logoutUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { token, user } = res.locals;

    await TokenService.logoutUserByTokenId(token.id, user);

    res.clearCookie('accessToken');

    return res.status(200).json({
      success: true,
      message: 'User logged out',
    });
  } catch (error) {
    return next(error);
  }
}

export async function logoutFromDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, user } = req.body;

    await TokenService.logoutUserByTokenId(id, user);

    res.clearCookie('accessToken');

    return res.status(200).json({
      success: true,
      message: 'User logged out from device',
    });
  } catch (error) {
    return next(error);
  }
}

export async function logoutFromAllDevices(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals;

    await TokenService.logoutFromAllDevices(user);

    res.clearCookie('accessToken');

    return res.status(200).json({
      success: true,
      message: 'User logged out from all devices',
    });
  } catch (error) {
    return next(error);
  }
}
