import bcrypt from 'bcrypt';
import prisma from '@database/Prisma';
import { User } from '@prisma/client';
import ApiException from '@errors/ApiException';
import AuthService from '@services/AuthService';

async function assignRole(userId: number, roleName: string) {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role ${roleName} not found`);
  }

  const userRole = await prisma.user.update({
    where: { id: userId },
    data: {
      Role: {
        connect: { name: roleName },
      },
    },
    include: { Role: true },
  });

  return userRole;
}

async function hasRole(userId: number, roleNames: string[]): Promise<boolean> {
  const userRole = await prisma.user.findUnique({
    where: { id: userId },
    include: { Role: true },
  });

  if (!userRole || !userRole.Role) return false;
  const lowerCaseRoleNames = roleNames.map((r) => r.toLowerCase());

  const hasRolename = lowerCaseRoleNames.includes(
    userRole.Role.name.toLowerCase(),
  );
  return hasRolename;
}

async function generateVerificationToken(user: User) {
  const { code, token, url } = await AuthService.generateVerificationToken({
    user,
  });

  return { code, token, url };
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
};
