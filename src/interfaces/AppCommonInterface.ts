export interface JwtToken {
  id: string;
  name: string | null;
  email: string;
  expiresAt: Date;
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
