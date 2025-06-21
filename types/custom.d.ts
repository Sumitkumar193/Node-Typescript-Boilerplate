import { Prisma, Role, User, UserRole } from '@prisma/client';
import { JwtToken, Pagination } from '@interfaces/AppCommonInterface';

export type UserWithRoles = User & {
  UserRoles: Array<UserRole & { Role: Role }>;
};

declare namespace Express {
    export interface Response {
        locals: {
            user?: UserWithRoles;
            token?: JwtToken;
            pagination?: Pagination;
        };
    }

    export interface Response<T> {
        success: boolean;
        message: string;
        data: T;
    }
  }