import { PrismaClient } from '@prisma/client';
import {
  PaginatedResponse,
  PaginationParams,
} from '../interfaces/AppCommonInterface';
import {
  findManyArgs,
  where as whereArgs,
} from '../interfaces/PrismaCustomInterface';
import RedisClient from '../cache/Redis';

const redis = RedisClient.getInstance();

const excludeCacheModels: Record<string, Record<string, boolean>> = {
  User: {
    findMany: true,
  },
};

const cacheableOperations: Record<string, boolean> = {
  findFirst: true,
  findUnique: true,
  findFirstOrThrow: true,
  findUniqueOrThrow: true,
  findMany: true,
  count: true,
};

const invalidateCacheOperations: Record<string, boolean> = {
  create: true,
  update: true,
  updateMany: true,
  upsert: true,
  deleteMany: true,
  delete: true,
};

// Default TTL for cached data (in seconds)
const DEFAULT_CACHE_TTL = parseInt(process.env.CACHE_TTL || '60', 10);

const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ args, model, operation, query }) {
        // Skip caching for excluded models
        if (excludeCacheModels?.[model]?.[operation]) {
          return query(args);
        }

        // Generate a cache key based on model, operation, and query args
        const cacheKey = `prisma:${model}:${operation}:${JSON.stringify(args)}`;

        // For cacheable operations (read queries)
        if (cacheableOperations[operation]) {
          try {
            // Check if data exists in Redis cache
            const cachedData = await redis.get(cacheKey);

            if (cachedData) {
              return JSON.parse(cachedData);
            }

            // Execute the query if not cached
            const result = await query(args);

            // Cache the result with TTL
            if (result !== null && result !== undefined) {
              await redis.set(
                cacheKey,
                JSON.stringify(result),
                'EX',
                DEFAULT_CACHE_TTL,
              );
            }

            return result;
          } catch (error) {
            console.error(`Cache error for ${cacheKey}:`, error);
            // Fallback to database query if cache fails
            return query(args);
          }
        }

        // For cache-invalidating operations (write queries)
        if (invalidateCacheOperations[operation]) {
          // Execute the query first
          const result = await query(args);

          try {
            // Invalidate all cached queries for this model
            const keys = await redis.keys(`prisma:${model}:*`);
            if (keys.length > 0) {
              await redis.del(...keys);
              console.log(
                `Invalidated ${keys.length} cache entries for model ${model}`,
              );
            }
          } catch (error) {
            console.error(`Cache invalidation error for ${model}:`, error);
          }

          return result;
        }

        // For any other operations, just execute the query without caching
        return query(args);
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
