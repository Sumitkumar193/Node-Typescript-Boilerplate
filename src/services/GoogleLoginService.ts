import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '@database/Prisma';
import ApiException from '@errors/ApiException';
import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client({
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
});

// Reusable function for both Passport and manual Token verification
export async function findOrCreateGoogleUser(payload: {
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
}): Promise<User> {
  const { googleId, email, name, picture } = payload;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email },
      include: { userProfile: true },
    });

    // 1. Existing user, link Google ID if not present
    if (user && !user.googleId) {
      return tx.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          googleId,
          Role: {
            connect: { name: 'User' },
          },
          userProfile: {
            upsert: {
              create: { avatarUrl: picture || '' },
              update: { avatarUrl: picture || '' },
            },
          },
        },
      });
    }

    // 2. Existing user, already linked
    if (user && user.googleId === googleId) {
      return user;
    }

    // 3. Conflict: Email exists but linked to a different Google ID
    if (user && user.googleId !== googleId) {
      throw new ApiException('Account conflict detected', 409);
    }

    // 4. New User creation
    const hashedPassword = bcrypt.hashSync(crypto.randomUUID(), 10);
    return tx.user.create({
      data: {
        email,
        name: name || 'New User',
        googleId,
        password: hashedPassword,
        Role: {
          connect: { name: 'User' },
        },
        userProfile: {
          create: { avatarUrl: picture || '' },
        },
      },
    });
  });
}

export async function verifyGoogleToken(token: string): Promise<User> {
  const audiences = [
    process.env.GOOGLE_CLIENT_ID || '',
    process.env.GOOGLE_ANDROID_CLIENT_ID || '',
    process.env.GOOGLE_IOS_CLIENT_ID || '',
  ].filter(x => x.length > 0);

  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: audiences,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new ApiException('Invalid Google token', 401);
  }

  if (
    payload.iss !== 'accounts.google.com' &&
    payload.iss !== 'https://accounts.google.com'
  ) {
    throw new ApiException('Invalid token issuer', 401);
  }

  if (!payload.email_verified) {
    throw new ApiException('Google email not verified', 401);
  }

  // Call the shared logic
  return findOrCreateGoogleUser({
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  });
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_REDIRECT_URI || '',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails[0]?.value;

        if (!email) {
          return done(
            new ApiException('No email found in Google profile', 400),
          );
        }

        // Use the extracted logic directly with the profile data
        const user = await findOrCreateGoogleUser({
          googleId: profile.id,
          email,
          name: profile.displayName,
          picture: profile.photos?.[0]?.value,
        });

        return done(null, user);
      } catch (error) {
        return done(error as Error, false);
      }
    },
  ),
);

export const GoogleLoginService = {
  initialize: () => passport.initialize(),
  authenticate: () =>
    passport.authenticate('google', {
      session: false,
      scope: ['profile', 'email'],
    }),
  validate: (token: string) => verifyGoogleToken(token),
};
