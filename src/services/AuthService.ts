import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { PasswordReset, User, UserVerification } from '@prisma/client';
import ApiException from '@errors/ApiException';
import MailService from '@services/MailService';
import TokenService from '@services/TokenService';
import { TransactionContext } from '@system/TransactionContext';

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

    const client = TransactionContext.getClient();

    const tokenRecord = await client.userVerification.upsert({
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

    return { token, code, url };
  }

  // =============================
  // TRANSACTIONAL OPERATIONS
  // =============================

  @TransactionContext.Transactional()
  static async registerUser(
    name: string,
    email: string,
    hashedPassword: string,
  ) {
    const client = TransactionContext.getClient();

    const user = await client.user.create({
      data: { name, email, password: hashedPassword },
    });

    await client.user.assignRole(user.id, 'User');
    const { url } = await client.user.generateVerificationToken(user);
    const token = await TokenService.generateUserToken(user);

    return { user, url, token };
  }

  @TransactionContext.Transactional()
  static async verifyUserEmail(
    user: User,
    tokenId: string,
    code: string,
  ): Promise<boolean> {
    const client = TransactionContext.getClient();
    return client.user.verifyToken(user, tokenId, code);
  }

  @TransactionContext.Transactional()
  static async resetUserPassword(
    passwordReset: PasswordReset,
    hashedPassword: string,
  ) {
    const client = TransactionContext.getClient();

    await client.user.update({
      where: { id: passwordReset.userId },
      data: { disabled: false, password: hashedPassword },
    });

    await client.passwordReset.update({
      where: { id: passwordReset.id },
      data: { disabled: true },
    });
  }
}

export default AuthService;
