import { Prisma } from '@prisma/client';

// Role Interface
export type RoleWhere = Prisma.RoleWhereInput;
export type RoleOrderBy = Prisma.RoleOrderByWithRelationInput;
export type RoleSelect = Prisma.RoleSelect;
export type RoleInclude = Prisma.RoleInclude;

// UserRole Interface
export type UserRoleWhere = Prisma.UserRoleWhereInput;
export type UserRoleOrderBy = Prisma.UserRoleOrderByWithRelationInput;
export type UserRoleSelect = Prisma.UserRoleSelect;
export type UserRoleInclude = Prisma.UserRoleInclude;

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

export type where = UserWhere | RoleWhere | UserRoleWhere | UserTokenWhere;
export type orderBy =
  | UserOrderBy
  | RoleOrderBy
  | UserRoleOrderBy
  | UserTokenOrderBy;
export type select = UserSelect | RoleSelect | UserRoleSelect | UserTokenSelect;
export type include =
  | UserInclude
  | RoleInclude
  | UserRoleInclude
  | UserTokenInclude;

export type findManyArgs = {
  skip?: number;
  take?: number;
  where?: where;
  orderBy?: orderBy;
  include?: include;
  select?: select;
};
