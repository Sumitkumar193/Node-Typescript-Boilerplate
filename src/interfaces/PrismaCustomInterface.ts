import {
  Prisma,
  Roles,
  User,
  UserToken,
  Product,
  Order,
  OrderItem,
} from '@prisma/client';

export type where =
  | Prisma.UserWhereInput
  | Prisma.RolesWhereInput
  | Prisma.UserTokenWhereInput
  | Prisma.ProductWhereInput
  | Prisma.OrderWhereInput
  | Prisma.OrderItemWhereInput
  | unknown;

export type findOneArgs =
  | Prisma.UserFindUniqueArgs
  | Prisma.RolesFindUniqueArgs
  | Prisma.UserTokenFindUniqueArgs
  | Prisma.ProductFindUniqueArgs
  | Prisma.OrderFindUniqueArgs
  | Prisma.OrderItemFindUniqueArgs;

export type createArgs =
  | Prisma.UserCreateArgs
  | Prisma.RolesCreateArgs
  | Prisma.UserTokenCreateArgs
  | Prisma.ProductCreateArgs
  | Prisma.OrderCreateArgs
  | Prisma.OrderItemCreateArgs;

export type updateArgs =
  | Prisma.UserUpdateArgs
  | Prisma.RolesUpdateArgs
  | Prisma.UserTokenUpdateArgs
  | Prisma.ProductUpdateArgs
  | Prisma.OrderUpdateArgs
  | Prisma.OrderItemUpdateArgs;

export type deleteArgs =
  | Prisma.UserDeleteArgs
  | Prisma.RolesDeleteArgs
  | Prisma.UserTokenDeleteArgs
  | Prisma.ProductDeleteArgs
  | Prisma.OrderDeleteArgs
  | Prisma.OrderItemDeleteArgs;

export type findOne = User | Roles | UserToken | Product | Order | OrderItem;

export type findMany =
  | User[]
  | Roles[]
  | UserToken[]
  | Product[]
  | Order[]
  | OrderItem[];

export type create = User | Roles | UserToken | Product | Order | OrderItem;

export type update = User | Roles | UserToken | Product | Order | OrderItem;

export type upsert = User | Roles | UserToken | Product | Order | OrderItem;

export type orderBy =
  | Prisma.UserOrderByWithRelationInput
  | Prisma.RolesOrderByWithRelationInput
  | Prisma.UserTokenOrderByWithRelationInput
  | Prisma.ProductOrderByWithRelationInput
  | Prisma.OrderOrderByWithRelationInput
  | Prisma.OrderItemOrderByWithRelationInput
  | Record<string, 'asc' | 'desc'>;

export type select =
  | Prisma.UserSelect
  | Prisma.RolesSelect
  | Prisma.UserTokenSelect
  | Prisma.ProductSelect
  | Prisma.OrderSelect
  | Prisma.OrderItemSelect
  | Record<string, boolean>;

export type include =
  | Prisma.UserInclude
  | Prisma.RolesInclude
  | Prisma.UserTokenInclude
  | Prisma.ProductInclude
  | Prisma.OrderInclude
  | Prisma.OrderItemInclude
  | Record<string, boolean>;

export type findManyArgs = {
  skip?: number;
  take?: number;
  where?: where;
  orderBy?: orderBy;
  include?: include;
  select?: select;
};
