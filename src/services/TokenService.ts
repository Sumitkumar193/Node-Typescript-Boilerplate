import { User, UserToken } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import prisma from '@database/Prisma';
import { JwtToken } from '@interfaces/AppCommonInterface';

class TokenService {
  static generateUserToken = async (user: User): Promise<string> => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    const userToken = await prisma.userToken.create({
      data: {
        userId: user.id,
        token: crypto.randomUUID(),
        disabled: false,
      },
    });

    const tokenData: JwtToken = {
      id: userToken.id,
      name: user.name,
      email: user.email,
      expiresAt,
    };

    const token = jwt.sign(tokenData, process.env.JWT_SECRET as string, {
      expiresIn: '24h',
    });

    return token;
  };

  static logoutUserByTokenId = async (
    id: string,
    user: User,
  ): Promise<void> => {
    await prisma.userToken.update({
      where: {
        id: parseInt(id, 10),
        userId: user.id,
        disabled: false,
      },
      data: {
        disabled: true,
      },
    });
  };

  static logoutFromAllDevices = async (user: User): Promise<void> => {
    await prisma.userToken.updateMany({
      where: {
        userId: user.id,
        disabled: false,
      },
      data: {
        disabled: true,
      },
    });
  };

  static getUserFromToken = async (token: string): Promise<User | null> => {
    try {
      if (!token) {
        return null;
      }

      const data = jwt.verify(
        token,
        process.env.JWT_SECRET as string,
      ) as JwtToken;

      const tokenRecord = await prisma.userToken.findUnique({
        where: { id: data.id },
      });

      if (!tokenRecord || tokenRecord.disabled) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { id: tokenRecord.userId, disabled: false },
        include: {
          UserRoles: {
            select: {
              Role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return user ?? null;
    } catch (error) {
      console.error('Error verifying token:', error);
      return null;
    }
  };

  static getUsersActiveTokens = async (user: User): Promise<UserToken[]> => {
    const activeTokens = await prisma.userToken.findMany({
      where: {
        userId: user.id,
        disabled: false,
      },
    });

    return activeTokens;
  };
}

export default TokenService;
