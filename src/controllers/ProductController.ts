import { Request, Response } from 'express';
import { Prisma, Product } from '@prisma/client';
import prisma from '../database/Prisma';
import validate from '../services/ValidationService';
import ApiException from '../errors/ApiException';
import {
  createProductValidation,
  updateProductValidation,
  updateProductStockValidation,
} from '../validations/ProductValidation';

export async function getProducts(req: Request, res: Response) {
  try {
    const { search, sortBy, sortDir } = req.query;
    const { pagination } = req.body;
    const { page, limit, offset } = pagination;

    const where = search ? { name: { contains: search as string } } : {};

    let orderBy: Prisma.ProductOrderByWithRelationInput = {};

    if (sortBy && sortDir) {
      orderBy = {
        [sortBy as string]: sortDir as Prisma.SortOrder,
      };
    }

    const result = await prisma.product.paginate<Product>({
      page,
      limit,
      offset,
      where,
      orderBy,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orderItems: true,
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

export async function getProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!product) {
      throw new ApiException('Product not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: product,
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

export async function createProduct(req: Request, res: Response) {
  try {
    const { name, description, price, stock } = req.body;

    const { hasError, errors } = validate(createProductValidation, {
      name,
      description,
      price,
      stock,
    });

    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        stock,
      },
    });

    return res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        data: error.data,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const inputs: Prisma.ProductUpdateInput = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      stock: req.body.stock,
    };

    const { hasError, errors } = validate(
      updateProductValidation,
      inputs,
    );

    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const product = await prisma.product.update({
      where: { id },
      data: inputs,
    });

    return res.status(200).json({
      success: true,
      data: product,
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

export async function deleteProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await prisma.product.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Product deleted',
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

export async function updateProductStock(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    const { hasError, errors } = validate(updateProductStockValidation, {
      stock,
    });

    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const product = await prisma.product.update({
      where: { id },
      data: { stock },
    });

    return res.status(200).json({
      success: true,
      data: product,
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
