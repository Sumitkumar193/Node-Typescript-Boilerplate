import { Prisma, Role, User, UserToken } from '@prisma/client';

export type where =
  | Prisma.UserWhereInput
  | Prisma.RoleWhereInput
  | Prisma.UserTokenWhereInput
  | unknown;

export type findOneArgs =
  | Prisma.UserFindUniqueArgs
  | Prisma.RoleFindUniqueArgs
  | Prisma.UserTokenFindUniqueArgs;

export type createArgs =
  | Prisma.UserCreateArgs
  | Prisma.RoleCreateArgs
  | Prisma.UserTokenCreateArgs;

export type updateArgs =
  | Prisma.UserUpdateArgs
  | Prisma.RoleUpdateArgs
  | Prisma.UserTokenUpdateArgs;

export type deleteArgs =
  | Prisma.UserDeleteArgs
  | Prisma.RoleDeleteArgs
  | Prisma.UserTokenDeleteArgs;

export type findOne = User | Role | UserToken;

export type findMany = User[] | Role[] | UserToken[];

export type create = User | Role | UserToken;

export type update = User | Role | UserToken;

export type upsert = User | Role | UserToken;

export type orderBy =
  | Prisma.UserOrderByWithRelationInput
  | Prisma.RoleOrderByWithRelationInput
  | Prisma.UserTokenOrderByWithRelationInput
  | Record<string, 'asc' | 'desc'>;

export type select =
  | Prisma.UserSelect
  | Prisma.RoleSelect
  | Prisma.UserTokenSelect
  | Record<string, boolean>;

export type include =
  | Prisma.UserInclude
  | Prisma.RoleInclude
  | Prisma.UserTokenInclude
  | Record<string, boolean>;

export type findManyArgs = {
  skip?: number;
  take?: number;
  where?: where;
  orderBy?: orderBy;
  include?: include;
  select?: select;
};
