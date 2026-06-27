import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

export async function setup() {
  config({ path: '.env.test' });

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_TEST! }),
  });

  try {
    // Delete in FK dependency order (child before parent) — runs once per test invocation
    await prisma.refreshToken.deleteMany({});
    await prisma.userVerification.deleteMany({});
    await prisma.userToken.deleteMany({});
    await prisma.passwordReset.deleteMany({});
    await prisma.userProfile.deleteMany({});
    await prisma.user.deleteMany({});
  } finally {
    await prisma.$disconnect();
  }
}
