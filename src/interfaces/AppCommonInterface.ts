import { IUserRoleEnum } from './UserInterface';

export interface JwtToken {
  id: string;
  email: string;
  role: IUserRoleEnum.Admin | IUserRoleEnum.Staff;
  tokenId: string;
  expiresAt: number;
}

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}
