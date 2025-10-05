import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { User, UserVerification } from '@prisma/client';
import prisma from '@database/Prisma';
import ApiException from '@errors/ApiException';
import MailService from '@services/MailService';

type GeneratedToken = { token: UserVerification; code: string; url: string };

class AuthService {
  private static replaceSimilarNumberAndCharacter(str: string) {
    return str
      .replace(/0/g, 'X')
      .replace(/O/g, 'Y')
      .replace(/I/g, 'Z')
      .replace(/l/g, 'W')
      .replace(/1/g, 'V')
      .replace(/5/g, 'U')
      .replace(/S/g, 'T');
  }

  private static normalizeUserCode(input: string) {
    return input.trim().toUpperCase();
  }

  static async generateCode(length: number) {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const randomBytes = crypto.randomBytes(16).toString('hex');

    // Apply replacements + uppercase, then slice to desired length
    const rawCode = AuthService.replaceSimilarNumberAndCharacter(randomBytes)
      .toUpperCase()
      .slice(0, length);

    const encryptedToken = await bcrypt.hash(rawCode, 10);
    return { code: rawCode, encryptedToken, expiresAt };
  }

  static async sendVerificationCode({
    user,
    code,
    tokenId,
  }: {
    user: User;
    code: string;
    tokenId: string;
  }) {
    const url = `${process.env.FRONTEND_URL}/verify-email/${tokenId}`;

    await MailService.send({
      to: user.email,
      subject: 'Email Verification',
      template: 'Auth/Verification',
      context: {
        name: user.name,
        url,
        code,
      },
    });

    return { url };
  }

  static async generateVerificationToken({
    user,
  }: {
    user: User;
  }): Promise<GeneratedToken> {
    if (user.isVerified) {
      throw new ApiException('User is already verified', 400);
    }

    const { code, encryptedToken, expiresAt } =
      await AuthService.generateCode(6);

    // create DB record first
    const tokenRecord = await prisma.userVerification.upsert({
      where: {
        userId: user.id,
      },
      update: {
        token: encryptedToken,
        expiresAt,
        disabled: false,
      },
      create: {
        token: encryptedToken,
        expiresAt,
        disabled: false,
        User: { connect: { id: user.id } },
      },
    });

    // IMPORTANT: send the DB id as tokenId (not the hash)
    const { url } = await AuthService.sendVerificationCode({
      user,
      code,
      tokenId: tokenRecord.id,
    });

    return { token: tokenRecord, code, url };
  }

  static async regenerateVerificationToken(
    user: User,
  ): Promise<GeneratedToken> {
    const { code, token, url } = await AuthService.generateVerificationToken({
      user,
    });

    return {
      token,
      code,
      url,
    };
  }

  static async validateToken(tokenId: string): Promise<boolean> {
    const token = await prisma.userVerification.findUnique({
      where: { id: tokenId, disabled: false, expiresAt: { gte: new Date() } },
    });
    return !!token;
  }

  static async verifyToken(tokenId: string, code: string) {
    const validate = await AuthService.validateToken(tokenId);

    if (!validate) {
      throw new ApiException('Invalid or expired verification token', 400);
    }

    const normalizedCode = AuthService.normalizeUserCode(code);

    const isValid = await bcrypt.compare(normalizedCode, code);

    if (!isValid) {
      throw new ApiException('Invalid verification code', 400);
    }

    const verification = await prisma.userVerification.update({
      where: { id: tokenId },
      data: {
        disabled: true,
        User: { update: { isVerified: true } },
      },
      include: { User: true },
    });

    return { success: true, token: verification };
  }
}

export default AuthService;
