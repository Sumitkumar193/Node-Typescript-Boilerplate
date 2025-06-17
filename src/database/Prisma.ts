import { PrismaClient, User } from '@prisma/client';
import { where as whereArgs, findManyArgs } from '@interfaces/PrismaInterfaces';
import {
  PaginationParams,
  PaginatedResponse,
} from '@interfaces/AppCommonInterface';
import UserModel from '@database/Extensions/Models/UserModel';
import RedisService from '@services/RedisService';

const svc = RedisService.getInstance();

const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async create({ model, operation, args, query }) {
        console.log(`Operation: ${operation} on model: ${model}`, args);
        return query(args);
      },
      async createMany({ model, operation, args, query }) {
        console.log(`Operation: ${operation} on model: ${model}`, args);
        return query(args);
      },
      async update({ model, operation, args, query }) {
        // Log the operation
        console.log(`Operation: ${operation} on model: ${model}`, args);

        // Call the original query
        return query(args);
      },
      async updateMany({ model, operation, args, query }) {
        // Log the operation
        console.log(`Operation: ${operation} on model: ${model}`, args);

        // Call the original query
        return query(args);
      },
    },
    user: {
      async findUnique({ args, query }) {
        const { where } = args;
        const cacheKey = `user:${where.id}`;
        const exists = await svc.exists(cacheKey);

        let user: User | null = null;
        if (exists) {
          const cachedUser = await svc.get(cacheKey);
          user = cachedUser ? JSON.parse(cachedUser) : null;
        } else {
          const fetchedUser = await query(args);
          user = fetchedUser as User | null;
          if (user) {
            await svc.set(cacheKey, JSON.stringify(user));
          }
        }

        return user;
      },
      async update({ args, query }) {
        const { where } = args;
        const cacheKey = `user:${where.id}`;
        await svc.del(cacheKey);
        return query(args);
      },
      async delete({ args, query }) {
        const { where } = args;
        const cacheKey = `user:${where.id}`;
        await svc.del(cacheKey);
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
    user: UserModel,
  },
});

export default prisma;
