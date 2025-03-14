import { Prisma, Roles, User } from '@prisma/client';
import { JwtToken, Pagination } from '../src/interfaces/AppCommonInterface';

declare namespace Express {
    export interface Request {
        body: {
            user?: User & { roles: Roles };
            token?: JwtToken;
            pagination?: Pagination;
        }
    }

    export interface Response<T> {
        success: boolean;
        message: string;
        data: T;
    }
  }