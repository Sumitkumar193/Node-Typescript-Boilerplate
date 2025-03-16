import { Prisma, Roles, User, UserToken } from '@prisma/client';

export type where =
  | Prisma.UserWhereInput
  | Prisma.RolesWhereInput
  | Prisma.UserTokenWhereInput
  | unknown;

export type findOneArgs =
  | Prisma.UserFindUniqueArgs
  | Prisma.RolesFindUniqueArgs
  | Prisma.UserTokenFindUniqueArgs;

export type createArgs =
  | Prisma.UserCreateArgs
  | Prisma.RolesCreateArgs
  | Prisma.UserTokenCreateArgs;

export type updateArgs =
  | Prisma.UserUpdateArgs
  | Prisma.RolesUpdateArgs
  | Prisma.UserTokenUpdateArgs;

export type deleteArgs =
  | Prisma.UserDeleteArgs
  | Prisma.RolesDeleteArgs
  | Prisma.UserTokenDeleteArgs;

export type findOne = User | Roles | UserToken;

export type findMany = User[] | Roles[] | UserToken[];

export type create = User | Roles | UserToken;

export type update = User | Roles | UserToken;

export type upsert = User | Roles | UserToken;

export type orderBy =
  | Prisma.UserOrderByWithRelationInput
  | Prisma.RolesOrderByWithRelationInput
  | Prisma.UserTokenOrderByWithRelationInput
  | Record<string, 'asc' | 'desc'>;

export type select =
  | Prisma.UserSelect
  | Prisma.RolesSelect
  | Prisma.UserTokenSelect
  | Record<string, boolean>;

export type include =
  | Prisma.UserInclude
  | Prisma.RolesInclude
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
