import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import prisma from '../Prisma';
import { User } from '@prisma/client';
import ApiException from '../../errors/ApiException';

async function assignRole(userId: number, roleName: string) {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role ${roleName} not found`);
  }

  const userRole = await prisma.userRole.create({
    data: {
      userId,
      roleId: role.id,
    },
    include: { Role: true },
  });

  return userRole;
}

async function hasRole(userId: number, roleNames: string[]) {
  const userRole = await prisma.userRole.findFirst({
    where: {
      userId,
      Role: {
        name: {
          in: roleNames,
        },
      },
    },
    include: { Role: true },
  });
  return !!userRole;
}

async function generateVerificationToken(user: User) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);
  const code = crypto.randomBytes(16).toString('hex').slice(0, 6).toUpperCase();
  const encryptdToken = await bcrypt.hash(code, 10);

  const token = await prisma.user.update({
    where: { id: user.id },
    data: {
      UserVerification: {
        upsert: {
          create: {
            userId: user.id,
            token: encryptdToken,
            expiresAt: expiresAt.toISOString(),
          },
          update: {
            token: encryptdToken,
            expiresAt,
          },
        },
      }
    },
    include: {
      UserVerification: true,
    },
  });

  return {
    code,
    token: token.UserVerification,
  };
}

async function verifyToken(user: User, tokenId: string, code: string) {
  const verification = await prisma.userVerification.findFirst({
    where: {
      id: tokenId,
      expiresAt: {
        gte: new Date(),
      },
    },
  });

  if (!verification) {
    throw new ApiException('Invalid or expired verification token', 400);
  }

  const isValid = await bcrypt.compare(code, verification.token);

  if (!isValid) {
    throw new ApiException('Invalid verification token', 400);
  }

  if (isValid) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    await prisma.userVerification.delete({
      where: { id: verification.id },
    });
  }

  return !!verification;
}

export default {
  assignRole,
  hasRole,
  generateVerificationToken,
  verifyToken,
}