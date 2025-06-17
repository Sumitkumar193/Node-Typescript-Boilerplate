import { where, orderBy, include, select } from '@interfaces/PrismaInterfaces';

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
