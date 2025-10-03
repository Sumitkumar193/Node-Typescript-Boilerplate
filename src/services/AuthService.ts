import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import prisma from '@database/Prisma';
import ApiException from '@errors/ApiException';
import MailService from '@services/MailService';
import { User } from '@prisma/client';

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

  static async generateCode(length: number, expireAfterMinutes: number = 15) {
    const expiresAt = new Date(Date.now() + expireAfterMinutes * 60 * 1000); // 15 minutes from now
    const randomBytes = crypto.randomBytes(16).toString('hex');

    // Apply replacements + uppercase, then slice to desired length
    const rawCode = AuthService.replaceSimilarNumberAndCharacter(randomBytes)
      .toUpperCase()
      .slice(0, length);

    const encryptedToken = await bcrypt.hash(rawCode, 10);
    return { code: rawCode, encryptedToken, expiresAt };
  }

  static async sendVerificationCode({
    email,
    code,
    tokenId,
  }: {
    email: string;
    code: string;
    tokenId: string;
  }) {
    const url = `${process.env.FRONTEND_URL}/verify-email/${tokenId}`;

    const tasks: Array<Promise<unknown>> = [];

    // Email is already normalized when passed to this function
    if (email) {
      tasks.push(
        MailService.send({
          to: email,
          subject: `${code} : RHV Email Verification`,
          html: `Dear Customer,
            <br/><br/>
            Please verify your email by clicking the link below:
            <br/>
            <a href="${url}">${url}</a>
            <br/><br/>
            <strong>Verification Code:</strong> ${code}
            <br/>
            <small>Note: This link is valid for 1 hour.</small>`,
        }),
      );
    }

    // run in background, capture results (don't crash main flow)
    if (tasks.length) Promise.allSettled(tasks);

    return { url };
  }

  static async generateVerificationToken(user: User) {
    if (user.isVerified) {
      throw new ApiException('User is already verified', 400);
    }

    const { code, encryptedToken, expiresAt } =
      await AuthService.generateCode(6);

    // Normalize email to lowercase
    const normalizedEmail = user.email.toLowerCase().trim();

    // create DB record first
    const tokenRecord = await prisma.userOTP.create({
      data: {
        token: encryptedToken,
        expiresAt,
        User: { connect: { id: user.id } },
      },
    });

    // IMPORTANT: send the DB id as tokenId (not the hash)
    const { url } = await AuthService.sendVerificationCode({
      email: normalizedEmail,
      code,
      tokenId: tokenRecord.id,
    });

    return { token: tokenRecord, code, url };
  }

  static async regenerateVerificationToken(user: User) {
    // Disable all previous tokens for this user
    await prisma.userOTP.updateMany({
      where: { userId: user.id, disabled: false },
      data: { disabled: true },
    });

    const { code, token } = await AuthService.generateVerificationToken(user);

    return {
      token,
      code,
      url: `${process.env.FRONTEND_URL}/verify-email/${token.id}`,
    };
  }

  static async validateToken(tokenId: string) {
    const token = await prisma.userOTP.findUnique({
      where: { id: tokenId, disabled: false, expiresAt: { gte: new Date() } },
    });
    if (!token) return false;
    return token.expiresAt >= new Date();
  }

  static async verifyToken(tokenId: string, code: string) {
    const verification = await prisma.userOTP.findUnique({
      where: { id: tokenId, disabled: false, expiresAt: { gte: new Date() } },
      include: { User: true },
    });

    if (!verification) {
      throw new ApiException('Invalid or expired verification token', 400);
    }

    const normalizedCode = AuthService.normalizeUserCode(code);

    const isValid = await bcrypt.compare(normalizedCode, verification.token);

    if (!isValid) {
      throw new ApiException('Invalid verification code', 400);
    }

    await prisma.userOTP.updateMany({
      where: { userId: verification.userId },
      data: { disabled: true },
    });

    await prisma.user.update({
      where: { id: verification.userId },
      data: { isVerified: true },
    });

    return { success: true, token: verification };
  }
}

export default AuthService;
