import { User } from '@prisma/client';
import prisma from '../database/Prisma';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JwtToken } from '../interfaces/AppCommonInterface';

class TokenService {
  static generateUserToken = async (user: User): Promise<string> => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    const userToken = await prisma.userToken.create({
      data: {
        userId: user.id,
        tokenId: crypto.randomUUID(),
        disabled: false,
      },
    });

    const tokenData: JwtToken = {
      id: userToken.id,
      name: user.name,
      email: user.email,
      expiresAt: expiresAt,
    };

    const token = jwt.sign(tokenData, process.env.JWT_SECRET as string, {
      expiresIn: '24h',
    });

    return token;
  };

  static logoutUser = async (token: JwtToken): Promise<void> => {
    await prisma.userToken.updateMany({
      where: {
        id: token.id,
        disabled: false,
      },
      data: {
        disabled: true,
      },
    });
  }

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
  }
}

export default TokenService;