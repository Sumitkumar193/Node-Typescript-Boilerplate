import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import MemoryCache from './CacheDrivers/MemoryCache';
import RedisCache from './CacheDrivers/RedisCache';
import { CacheStorage } from '../interfaces/CacheInterface';
import {
  PaginatedResponse,
  PaginationParams,
} from '../interfaces/AppCommonInterface';
import {
  findManyArgs,
  where as whereArgs,
} from '../interfaces/PrismaCustomInterface';

const cacheDriver = process.env.CACHE_DRIVER || 'memory';

// Create cache instance based on driver
const cacheInstance: CacheStorage = (() => {
  switch (cacheDriver) {
    case 'redis':
      return new RedisCache();
    case 'memory':
    default:
      return new MemoryCache();
  }
})();

// Generate consistent hash key for caching
const generateCacheKey = (
  model: string,
  operation: string,
  args: unknown,
): string => {
  const argsString = JSON.stringify(args);
  const hash = crypto
    .createHash('md5')
    .update(`${model}:${operation}:${argsString}`)
    .digest('hex');
  return hash;
};

// Determine if operation should be cached
const isCacheableOperation = (operation: string): boolean => {
  const readOperations: Record<string, boolean> = {
    findUnique: true,
    findUniqueOrThrow: true,
    findFirst: true,
    findFirstOrThrow: true,
    findMany: true,
    count: true,
    aggregate: true,
  };
  return !!readOperations[operation];
};

// Determine if operation should invalidate cache
const isInvalidatingOperation = (operation: string): boolean => {
  const writeOperations: Record<string, boolean> = {
    create: true,
    createMany: true,
    update: true,
    updateMany: true,
    delete: true,
    deleteMany: true,
    upsert: true,
  };
  return !!writeOperations[operation];
};

const getModelFromOperation = (model: string): string => model.toLowerCase();

const getRelatedFindManyPattern = (model: string): string =>
  `^${model}:findMany`;

const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const modelName = getModelFromOperation(model);

        if (
          !isCacheableOperation(operation) &&
          !isInvalidatingOperation(operation)
        ) {
          return query(args);
        }

        // Generate cache key
        const cacheKey = generateCacheKey(modelName, operation, args);

        if (isInvalidatingOperation(operation)) {
          if (operation === 'update' && args.where?.id) {
            const userCacheKey = generateCacheKey(modelName, 'findUnique', {
              id: args.where.id,
            });
            await cacheInstance.delete(userCacheKey);

            const findManyPattern = getRelatedFindManyPattern(modelName);
            await cacheInstance.clear(findManyPattern);
          } else {
            await cacheInstance.clear(`^${modelName}:`);
          }
          return query(args);
        }

        const cachedResult = await cacheInstance.get(cacheKey);
        if (cachedResult !== undefined) {
          return cachedResult;
        }

        const result = await query(args);
        await cacheInstance.set(cacheKey, result);
        return result;
      },
    },
  },
  model: {
    $allModels: {
      async paginate<T>({
        page = 1,
        limit = 10,
        offset,
        where = {},
        orderBy = {},
        include,
        select,
      }: PaginationParams): Promise<PaginatedResponse<T>> {
        const skip = offset !== undefined ? offset : (page - 1) * limit;

        // @ts-expect-error - This works at runtime but TypeScript doesn't know about it
        const totalCount = await this.count({ where });

        const queryOptions: whereArgs & findManyArgs = {
          skip,
          take: limit,
          where,
          orderBy,
        };

        if (include) queryOptions.include = include;
        if (select) queryOptions.select = select;

        // @ts-expect-error - This works at runtime but TypeScript doesn't know about it
        const data = await this.findMany(queryOptions);

        return {
          data,
          meta: {
            page,
            limit,
            total: {
              items: totalCount,
              pages: Math.ceil(totalCount / limit),
            },
          },
        };
      },
    },
  },
});

export default prisma;
