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
        connect: { id: role.id },
      },
    },
    include: { Role: true },
  });

  return userRole;
}

async function hasRole(userId: number, ...roleNames: string[]) {
  const userRole = await prisma.user.findFirst({
    where: {
      id: userId,
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
  const { code, token } = await AuthService.generateVerificationToken(user);

  return {
    code,
    token,
  };
}

async function verifyToken(user: User, tokenId: string, code: string) {
  const isValidToken = await AuthService.validateToken(tokenId);

  if (!isValidToken) {
    throw new ApiException('Invalid or expired verification token', 400);
  }

  const verification = await AuthService.verifyToken(tokenId, code);

  return verification.success;
}

export default {
  assignRole,
  hasRole,
  generateVerificationToken,
  verifyToken,
};
