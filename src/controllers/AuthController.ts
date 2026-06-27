import { NextFunction, Request, Response } from 'express';
import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import ApiException from '@errors/ApiException';
import prisma from '@database/Prisma';
import {
  createUserValidation,
  forgotPasswordValidation,
  loginValidation,
  passwordResetValidation,
} from '@validations/UserValidation';
import validate from '@services/ValidationService';
import RefreshTokenService from '@services/RefreshTokenService';
import MailService from '@services/MailService';
import {
  AccessTokenPayload,
  UserWithRoles,
} from '@interfaces/AppCommonInterface';
import AuthService from '@services/AuthService';
import RedisService from '@services/RedisService';

function extractMeta(req: Request) {
  return {
    // trust proxy is not configured in this app — req.ip may be the proxy address
    // in production. Configure app.set('trust proxy', ...) for accurate client IPs.
    ip: req.ip,
    userAgent: (req.headers['user-agent'] ?? '').slice(0, 500),
  };
}

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

    const hashedPassword = await bcrypt.hash(AuthService.prehash(password), 10);

    const user: User = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    await prisma.user.assignRole(user.id, 'User');
    await prisma.user.generateVerificationToken(user);

    const { accessToken, refreshToken: newRefreshToken } = await RefreshTokenService.login(
      user.id,
      extractMeta(req),
    );

    return res.status(201).json({
      success: true,
      message: 'User created',
      data: {
        user: {
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
        },
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getVerifyEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const { user } = res.locals;

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

    if (user.isVerified) {
      throw new ApiException('User is already verified', 400);
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

export async function regenerateVerificationToken(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals;

    if (user.isVerified) {
      throw new ApiException('User is already verified', 400);
    }

    const { url } = await prisma.user.generateVerificationToken(user);

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
      throw new ApiException('Invalid email or password', 401);
    }

    if (user.disabled) {
      throw new ApiException(
        'Your account is temporarily disabled, Please reset password to continue.',
        400,
      );
    }

    const verifyPassword = await bcrypt.compare(
      AuthService.prehash(password),
      user.password,
    );

    if (!verifyPassword) {
      throw new ApiException('Invalid email or password', 401);
    }

    const { accessToken, refreshToken: newRefreshToken } = await RefreshTokenService.login(
      user.id,
      extractMeta(req),
    );

    return res.status(200).json({
      success: true,
      message: 'User logged in',
      data: {
        user: {
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
        },
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function refreshToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { refreshToken: raw } = req.body;

    if (!raw) {
      throw new ApiException('Refresh token required', 401);
    }

    const { accessToken, refreshToken: newRaw } =
      await RefreshTokenService.refresh(raw, extractMeta(req));

    return res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: { accessToken, refreshToken: newRaw },
    });
  } catch (error) {
    return next(error);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email } = req.body;

    const { hasError, errors } = validate(forgotPasswordValidation, { email });

    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'Password reset request has been processed successfully',
      });
    }

    if (user.disabled) {
      return res.status(200).json({
        success: true,
        message: 'Password reset request has been processed successfully',
      });
    }

    const {
      code: rawToken,
      encryptedToken,
      expiresAt,
    } = await AuthService.generateCode(32);

    const passwordResetToken = await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: encryptedToken,
        expiresAt,
      },
    });

    await MailService.send({
      to: user.email,
      subject: 'Forgot Password',
      template: 'Auth/Reset',
      context: {
        name: user.name,
        url: `${process.env.FRONTEND_URL}/forgot-password/${passwordResetToken.id}?token=${rawToken}`,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset request has been processed successfully',
    });
  } catch (error) {
    return next(error);
  }
}

export async function getResetPasswordEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const { token: rawToken } = req.query as { token: string };

    const passwordReset = await prisma.passwordReset.findFirst({
      where: {
        id,
        disabled: false,
        expiresAt: { gte: new Date() },
      },
      include: { User: { select: { email: true, name: true } } },
    });

    if (
      !passwordReset ||
      !rawToken ||
      !(await bcrypt.compare(rawToken, passwordReset.token))
    ) {
      throw new ApiException('Password reset token is invalid or expired', 404);
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset token is valid',
      data: passwordReset.User,
    });
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const { token: rawToken, password, confirmPassword } = req.body;

    const passwordReset = await prisma.passwordReset.findFirst({
      where: {
        id,
        disabled: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (
      !passwordReset ||
      !rawToken ||
      !(await bcrypt.compare(rawToken, passwordReset.token))
    ) {
      throw new ApiException('Password reset token is invalid or expired', 404);
    }

    const { hasError, errors } = validate(passwordResetValidation, {
      password,
      confirmPassword,
    });

    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const hashedPassword = await bcrypt.hash(AuthService.prehash(password), 10);

    await prisma.user.update({
      where: { id: passwordReset.userId },
      data: { disabled: false, password: hashedPassword },
    });

    await prisma.passwordReset.update({
      where: { id },
      data: { disabled: true },
    });

    try {
      await RedisService.getInstance().del(`user:${passwordReset.userId}`);
    } catch {
      /* non-fatal */
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. Please login to your account.',
    });
  } catch (error) {
    return next(error);
  }
}

export async function logoutUser(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { token } = res.locals as { token: AccessTokenPayload };
    await RefreshTokenService.logout(token.sid, token.exp);

    return res.status(200).json({
      success: true,
      message: 'User logged out',
    });
  } catch (error) {
    return next(error);
  }
}

export async function logoutFromAllDevices(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals as { user: UserWithRoles };
    await RefreshTokenService.revokeAllSessions(user.id);

    return res.status(200).json({
      success: true,
      message: 'User logged out from all devices',
    });
  } catch (error) {
    return next(error);
  }
}

export async function getSessions(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user, token } = res.locals as {
      user: UserWithRoles;
      token: AccessTokenPayload;
    };

    const sessions = await RefreshTokenService.listSessions(user.id, token.sid);

    return res.status(200).json({
      success: true,
      data: { sessions },
    });
  } catch (error) {
    return next(error);
  }
}

export async function revokeSessionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { jti } = req.params;
    const { user, token } = res.locals as {
      user: UserWithRoles;
      token: AccessTokenPayload;
    };

    await RefreshTokenService.revokeSession(user.id, jti, token.sid, token.exp);

    return res.status(200).json({
      success: true,
      message: 'Session revoked',
    });
  } catch (error) {
    return next(error);
  }
}
