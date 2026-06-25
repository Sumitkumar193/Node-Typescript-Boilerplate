import bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import ApiException from '@errors/ApiException';
import AuthService from '@services/AuthService';
import { TransactionContext } from '@system/TransactionContext';

async function assignRole(userId: number, roleName: string) {
  const client = TransactionContext.getClient();

  const role = await client.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role ${roleName} not found`);
  }

  const userRole = await client.user.update({
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
  const client = TransactionContext.getClient();

  const userRole = await client.user.findUnique({
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
  const client = TransactionContext.getClient();

  const verification = await client.userVerification.findFirst({
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

  await client.user.update({
    where: { id: user.id },
    data: { isVerified: true },
  });

  await client.userVerification.delete({
    where: { id: verification.id },
  });

  return true;
}

export default {
  assignRole,
  hasRole,
  generateVerificationToken,
  verifyToken,
};
