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

// Country Interface
export type CountryWhere = Prisma.CountryWhereInput;
export type CountryOrderBy = Prisma.CountryOrderByWithRelationInput;
export type CountrySelect = Prisma.CountrySelect;
export type CountryInclude = Prisma.CountryInclude;

// FileType Interface
export type FileTypeWhere = Prisma.FileTypeWhereInput;
export type FileTypeOrderBy = Prisma.FileTypeOrderByWithRelationInput;
export type FileTypeSelect = Prisma.FileTypeSelect;
export type FileTypeInclude = Prisma.FileTypeInclude;

// Organization Interface
export type OrganizationWhere = Prisma.OrganizationWhereInput;
export type OrganizationOrderBy = Prisma.OrganizationOrderByWithRelationInput;
export type OrganizationSelect = Prisma.OrganizationSelect;
export type OrganizationInclude = Prisma.OrganizationInclude;

export type where =
  | UserWhere
  | RoleWhere
  | UserTokenWhere
  | CountryWhere
  | FileTypeWhere
  | OrganizationWhere;
export type orderBy =
  | UserOrderBy
  | RoleOrderBy
  | UserTokenOrderBy
  | CountryOrderBy
  | FileTypeOrderBy
  | OrganizationOrderBy;
export type select =
  | UserSelect
  | RoleSelect
  | UserTokenSelect
  | CountrySelect
  | FileTypeSelect
  | OrganizationSelect;
export type include =
  | UserInclude
  | RoleInclude
  | UserTokenInclude
  | CountryInclude
  | FileTypeInclude
  | OrganizationInclude;

export type findManyArgs = {
  skip?: number;
  take?: number;
  where?: where;
  orderBy?: orderBy;
  include?: include;
  select?: select;
};
