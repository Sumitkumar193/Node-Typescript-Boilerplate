// src/database/Prisma.ts

import { Prisma, PrismaClient } from '@prisma/client';
import { PaginatedResponse, PaginationMeta } from '../interfaces/AppCommonInterface';

const prismaExtension = {
  model: {
    $allModels: {
      async paginate<T>(
        this: T,
        args: Prisma.Exact<
          Prisma.Args<T, 'findMany'>,
          PaginationMeta
        >,
      ): Promise<PaginatedResponse<T[]>> {
        console.log(args);
        return {
          data: [],
          meta: {
            limit: 0,
            page: 0,
            total: {
              items: 0,
              pages: 0,
            },
          }
        };
      },
    },
  },
} as const;

const prisma = new PrismaClient().$extends(prismaExtension);

type PrismaExtension = typeof prismaExtension.model;
export type ExtendedPrismaClient = Omit<PrismaClient, '$extends'> & {
  [K in keyof PrismaExtension]: {
    [M in keyof PrismaExtension[K]]: PrismaExtension[K][M];
  };
};

export default prisma as unknown as ExtendedPrismaClient;