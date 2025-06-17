import { Prisma, User, UserRole } from '@prisma/client';
import { JwtToken, Pagination } from '@interfaces/AppCommonInterface';

declare namespace Express {
    export interface Response {
        locals: {
            user?: User & UserRole[];
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