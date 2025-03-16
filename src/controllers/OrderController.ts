import { Request, Response } from 'express';
import { Prisma, Order, OrderItem, Product, OrderStatus } from '@prisma/client';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

export async function getOrders(req: Request, res: Response) {
  try {
    const { search, sortBy, sortDir, status } = req.query;
    const { pagination, user } = req.body;
    const { page, limit, offset } = pagination;

    const where: Prisma.OrderWhereInput = {};

    if (search) {
      where.OR = [
        {
          id: {
            equals: search as string,
          },
        },
        {
          items: {
            some: {
              product: {
                name: {
                  contains: search as string,
                },
              },
            },
          },
        },
      ];
    }

    if (status) {
      where.AND = [
        {
          status: {
            equals: status as OrderStatus,
          },
        },
      ];
    }

    if (user.roles.name === 'User') {
      where.AND = [
        {
          userId: {
            equals: user.id,
          },
        },
      ];
    }

    let orderBy: Prisma.OrderOrderByWithRelationInput = {};

    if (sortBy && sortDir) {
      orderBy = {
        [sortBy as string]: sortDir as Prisma.SortOrder,
      };
    }

    const result = await prisma.order.paginate<Order>({
      page,
      limit,
      offset,
      where,
      orderBy,
      select: {
        id: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function getOrder(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: {
        id,
        userId: req.body.user.id,
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        status: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            purchasePrice: true,
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new ApiException('Order not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function createOrder(req: Request, res: Response) {
  try {
    type item = {
      productId: string;
      quantity: number;
      purchasePrice?: number;
      originalItemPrice?: number;
    };

    const { user, items } = req.body as {
      user: { id: string };
      items: item[];
    };

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: items.map((item) => item.productId),
        },
      },
      select: {
        id: true,
        stock: true,
        price: true,
      },
    });

    const reduce: Promise<Product>[] = [];

    const fetchedItems = items.map((item) => {
      const checkProduct = products.find(
        (product) => product.id === item.productId,
      );
      if (!checkProduct) {
        throw new ApiException('Product not found', 404);
      }

      if (checkProduct.stock < item.quantity) {
        throw new ApiException('Product out of stock', 400);
      }

      const purchasePrice = checkProduct.price * item.quantity;
      const originalItemPrice = checkProduct.price;

      reduce.push(
        prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        }),
      );

      return {
        ...item,
        purchasePrice,
        originalItemPrice,
      };
    });

    const totalAmount = fetchedItems.reduce(
      (acc, item) => acc + (item.purchasePrice ?? 0),
      0,
    );

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        totalAmount,
        items: {
          createMany: {
            data: fetchedItems.map(
              (item) =>
                ({
                  productId: item.productId,
                  quantity: item.quantity,
                  purchasePrice: item.purchasePrice,
                }) as OrderItem,
            ),
          },
        },
      },
    });

    await Promise.all(reduce);

    return res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function updateOrder(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status }: { status: OrderStatus } = req.body;

    // First, find the order that matches our conditions
    const orderToUpdate = await prisma.order.findFirst({
      where: {
        id,
        NOT: {
          OR: [
            { status: OrderStatus.COMPLETED },
            { status: OrderStatus.CANCELLED },
          ],
        },
      },
    });

    if (!orderToUpdate) {
      throw new ApiException(
        'Order not found or cannot be updated due to its status',
        404,
      );
    }

    // Then update it using the ID
    const order = await prisma.order.update({
      where: { id: orderToUpdate.id },
      data: { status },
    });

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function deleteOrder(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await prisma.order.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Order deleted',
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}
