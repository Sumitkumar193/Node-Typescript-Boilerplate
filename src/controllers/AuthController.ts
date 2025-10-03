import { NextFunction, Request, Response } from 'express';
import { User, UserInvite } from '@prisma/client';
import bcrypt from 'bcryptjs';
import ApiException from '@errors/ApiException';
import prisma from '@database/Prisma';
import {
  createUserValidation,
  forgotPasswordValidation,
  loginValidation,
  passwordResetValidation,
  createInviteValidation,
} from '@validations/UserValidation';
import validate from '@services/ValidationService';
import TokenService from '@services/TokenService';
import MailService from '@services/MailService';
import AuthService from '@services/AuthService';

/**
 * @description Invite user by email for Organization Sign UP
 * @access Private (Admin)
 * @route POST /api/auth/invite
 * @returns {Object} 201 - Invite sent
 */
export async function createInvite(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, type } = req.body;

    const { hasError, errors } = validate(createInviteValidation, req.body);

    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const { code } = await AuthService.generateCode(16, 120);

    const invite = await prisma.userInvite.upsert({
      where: { email },
      update: { token: code, active: true },
      create: {
        email,
        active: true,
        token: code,
        type,
      },
    });

    const url = `${process.env.FRONTEND_URL}/signup?token=${invite.token}&email=${invite.email}`;

    MailService.send({
      to: email,
      subject: 'RHV: Invitation',
      html: `You have been invited to sign up into Ray Health Vision.
      
      Please click the link below to sign up:
      ${url}
      
      Thanks and regards,
      Ray Health Vision Team
      `,
    });

    return res.status(201).json({
      success: true,
      message: 'Invite sent',
    });
  } catch (error) {
    return next(error);
  }
}

export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { name, email, password } = req.body;

    const { hasError, errors } = validate(createUserValidation, req.body);

    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ApiException('User already exists', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isVerified: false,
        Role: { connect: { name: 'User' } },
      },
    });

    await AuthService.generateVerificationToken(user);

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function registerByInvite(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { code } = req.params;
  } catch (error) {
    return next(error);
  }
}

/**
 * @description Get email verification token details
 * @access Authenticated
 * @route GET /api/auth/verify/:id
 * @returns {Object} 200 - Verification token details
 */
export async function getVerifyEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const { user } = res.locals;

    if (user.isVerified) {
      throw new ApiException('User is already verified', 400);
    }

    const verificationToken = await prisma.userVerification.findFirst({
      where: {
        id,
        userId: user.id,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    if (!verificationToken) {
      throw new ApiException('Invalid or expired verification token', 404);
    }

    return res.status(200).json({
      success: true,
      message: 'Verification token is valid',
      data: {
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * @description Regenerate email verification token
 * @access Authenticated
 * @route PUT /api/auth/verify/regenerate
 * @returns {Object} 200 - New verification token details
 */
export async function regenerateVerificationToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals;

    if (user.isVerified) {
      throw new ApiException('User is already verified', 400);
    }

    const { url } = await AuthService.regenerateVerificationToken(user);

    return res.status(200).json({
      success: true,
      message: 'Verification token regenerated successfully',
      data: {
        url,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * @description Verify user email using token
 * @access Authenticated
 * @route POST /api/auth/verify/:id
 * @returns {Object} 200 - Email verified
 */
export async function verifyEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id: tokenId } = req.params;
    const { user } = res.locals;
    const { code } = req.body;

    if (user.isVerified) {
      throw new ApiException('User is already verified', 400);
    }

    const verify = await prisma.user.verifyToken(user, tokenId, code);

    if (!verify) {
      throw new ApiException('Invalid or expired verification token', 404);
    }

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: {
          name: user.name,
          email: user.email,
          isVerified: true,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * @description Login user
 * @access Public
 * @route POST /api/auth/login
 * @returns {Object} 200 - User logged in
 */
export async function loginUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, password } = req.body;

    const { hasError, errors } = validate(loginValidation, {
      email,
      password,
    });

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
          isVerified: user.isVerified,
        },
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * @description Forgot password - send reset link to email
 * @access Public
 * @route POST /api/auth/forgot-password
 * @returns {Object} 200 - Reset link sent
 */
export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email } = req.body;

    const { hasError, errors } = validate(forgotPasswordValidation, {
      email,
    });

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

    const { code, encryptedToken, expiresAt } = await AuthService.generateCode(
      8,
      parseInt(process.env.PASSWORD_RESET_TIME ?? '15', 10),
    );

    const passwordResetToken = await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: encryptedToken,
        expiresAt,
      },
    });

    MailService.send({
      to: user.email,
      subject: 'Forgot Password',
      html: `Hello ${user.name},
      We have received an request to change password for account.
      Note: If you have not requested for this kindly ignore this email.
      
      Here is link to reset your password:
      ${process.env.FRONTEND_URL}/forgot-password/${passwordResetToken.id}?email=${user.email}&code=${code} 
      This link will be valid for next 15 minutes.`,
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset request has been processed successfully',
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * @description Get password reset token details
 * @access Public
 * @route GET /api/auth/forgot-password/:id
 * @returns {Object} 200 - Password reset token details
 */
export async function getResetPasswordEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;

    const passwordReset = await prisma.passwordReset.findFirst({
      where: {
        id,
        disabled: false,
        expiresAt: {
          gte: new Date(),
        },
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!passwordReset) {
      throw new ApiException('Password reset token is invalid or expired', 404);
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset token is valid',
      data: passwordReset.user,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * @description Reset user password using token
 * @access Public
 * @route POST /api/auth/forgot-password/:id
 * @returns {Object} 200 - Password reset successful
 */
export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const { code, password, confirmPassword } = req.body;

    const passwordReset = await prisma.passwordReset.findFirst({
      where: {
        id,
        disabled: false,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    if (!passwordReset) {
      throw new ApiException('Password reset token is invalid or expired', 404);
    }

    const validateResetCode = await bcrypt.compare(code, passwordReset.token);

    if (!validateResetCode) {
      throw new ApiException('Invalid password reset code', 400);
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
        id: passwordReset.userId,
      },
      data: {
        disabled: false,
        password: hashedPassword,
      },
    });

    await prisma.passwordReset.updateMany({
      where: {
        userId: passwordReset.userId,
        disabled: false,
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

/**
 * @description Logout user from current device
 * @access Authenticated
 * @route POST /api/auth/logout
 * @returns {Object} 200 - User logged out
 */
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

/**
 * @description Logout user from specific device
 * @access Authenticated
 * @route POST /api/auth/logout/:id
 * @returns {Object} 200 - User logged out from device
 */
export async function logoutFromDevice(
  req: Request,
  res: Response,
  next: NextFunction,
) {
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

/**
 * @description Logout user from all devices
 * @access Authenticated
 * @route POST /api/auth/logout/all
 * @returns {Object} 200 - User logged out from all devices
 */
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
