import { where, orderBy, include, select } from '@interfaces/PrismaInterfaces';
import { Prisma } from '@prisma/client';
import { SendMailOptions } from 'nodemailer';

export interface JwtToken {
  id: number;
  name: string | null;
  email: string;
  expiresAt: Date;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  where?: where;
  orderBy?: orderBy;
  include?: include;
  select?: select;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: {
    items: number;
    pages: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface JoiValidationErrors {
  hasError: boolean;
  errors: Record<string, string>;
}

export interface MailJobData extends SendMailOptions {
  to: string | string[];
  subject: string;
  cc?: string | string[];
  bcc?: string | string[];
  html?: string;
  template?: string;
  context?: Record<string, string | number | null>;
}

export type UserWithRoles = Prisma.UserGetPayload<{
  omit: { password: true };
  include: {
    Role: true;
  };
}>;

export type StorageParams = {
  storagePath: string;
  fileType: 'PUBLIC' | 'PRIVATE';
};
