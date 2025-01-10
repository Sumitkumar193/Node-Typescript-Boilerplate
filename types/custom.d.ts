import { Prisma, User } from '@prisma/client';
import { JwtToken, Pagination } from '../src/interfaces/Common';

declare namespace Express {
    export interface Request {
        user?: User;
        token?: JwtToken;
        pagination?: Pagination;
    }

    export interface Response<T> {
        success: boolean;
        message: string;
        data: T;
    }
}