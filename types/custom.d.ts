import { Field } from 'multer';
import { Prisma, Role, User, UserRole } from '@prisma/client';
import { JwtToken, Pagination, UserWithRoles } from '@interfaces/AppCommonInterface';

declare namespace Express {
    export interface Response {
        locals: {
            user?: UserWithRoles;
            token?: JwtToken;
            pagination?: Pagination;
            uploadFields?: Field[];
        };
    }

    export interface Response<T> {
        success: boolean;
        message: string;
        data: T;
    }
  }