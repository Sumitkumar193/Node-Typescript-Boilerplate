import { Prisma } from '@prisma/client';

// Role Interface
export type RoleWhere = Prisma.RoleWhereInput;
export type RoleOrderBy = Prisma.RoleOrderByWithRelationInput;
export type RoleSelect = Prisma.RoleSelect;
export type RoleInclude = Prisma.RoleInclude;

// User Interface
export type UserWhere = Prisma.UserWhereInput;
export type UserOrderBy = Prisma.UserOrderByWithRelationInput;
export type UserSelect = Prisma.UserSelect;
export type UserInclude = Prisma.UserInclude;

// UserToken Interface
export type UserTokenWhere = Prisma.UserTokenWhereInput;
export type UserTokenOrderBy = Prisma.UserTokenOrderByWithRelationInput;
export type UserTokenSelect = Prisma.UserTokenSelect;
export type UserTokenInclude = Prisma.UserTokenInclude;

export type where = UserWhere | RoleWhere | UserTokenWhere;
export type orderBy = UserOrderBy | RoleOrderBy | UserTokenOrderBy;
export type select = UserSelect | RoleSelect | UserTokenSelect;
export type include = UserInclude | RoleInclude | UserTokenInclude;

export type findManyArgs = {
  skip?: number;
  take?: number;
  where?: where;
  orderBy?: orderBy;
  include?: include;
  select?: select;
};
