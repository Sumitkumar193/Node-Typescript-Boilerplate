import { PrismaClient } from '@prisma/client';
import {
  where as whereArgs,
  findManyArgs,
} from '../interfaces/PrismaInterfaces';
import {
  PaginationParams,
  PaginatedResponse,
} from '../interfaces/AppCommonInterface';

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
    user: {
      async assignRole(userId: number, roleName: string) {
        const role = await prisma.role.findUnique({
          where: { name: roleName },
        });

        if (!role) {
          throw new Error(`Role ${roleName} not found`);
        }

        const userRole = await prisma.userRole.create({
          data: {
            userId,
            roleId: role.id,
          },
          include: { Role: true },
        });

        return userRole;
      },
      async hasRole(userId: number, roleNames: string[]) {
        const userRole = await prisma.userRole.findFirst({
          where: {
            userId,
            Role: {
              name: {
                in: roleNames,
              },
            },
          },
          include: { Role: true },
        });
        return !!userRole;
      },
    },
  },
});

export default prisma;
