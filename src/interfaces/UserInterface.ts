import { Role } from '@prisma/client';

export interface IUser {
  id: string;
  name?: string;
  email: string;
  password: string;
  role: Role;
  disabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
